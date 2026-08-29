import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { SigningJwk, UserRole, UserStatus } from '@shared-auth';
import { AuthProvider, User } from '../identity/user.entity';
import { IdentityService } from '../identity/identity.service';
import { UsersServiceClient } from './internal/users-service-client';
import { RegisterDto } from './dto/register.dto';
import {
  RegisterResponseDto,
  toRegisterResponse,
} from './dto/register-response.dto';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto, toLoginResponse } from './dto/login-response.dto';
import {
  AuthMeResponseDto,
  toAuthMeResponse,
} from './dto/auth-me-response.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshDto } from './dto/refresh.dto';
import {
  RefreshResponseDto,
  toRefreshResponse,
} from './dto/refresh-response.dto';
import { SocialAuthProvider, SocialLoginDto } from './dto/social-login.dto';
import { TokenService } from './token.service';
import { GoogleTokenVerifierService } from './social/google-token-verifier.service';
import { AppleTokenVerifierService } from './social/apple-token-verifier.service';
import { SocialTokenVerifier } from './interfaces/social-token-verifier.interface';
import type { Mailer } from './interfaces/mailer.interface';
import { MAILER } from './mailer/mailer.token';
import { EmailVerificationTokenService } from './email-verification-token.service';
import { VerifyEmailDto } from './dto/verify-email.dto';

// Message cố tình chung chung cho mọi lý do đăng nhập thất bại (sai email,
// sai mật khẩu, tài khoản suspended/deleted, account chỉ đăng nhập social)
// — không tiết lộ lý do cụ thể, tránh lộ email có tồn tại trong hệ thống.
const INVALID_CREDENTIALS_MESSAGE = 'Email hoặc mật khẩu không đúng';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  private readonly socialVerifiers: Record<
    SocialAuthProvider,
    SocialTokenVerifier
  >;

  constructor(
    private readonly identityService: IdentityService,
    private readonly tokenService: TokenService,
    googleTokenVerifier: GoogleTokenVerifierService,
    appleTokenVerifier: AppleTokenVerifierService,
    private readonly emailVerificationTokenService: EmailVerificationTokenService,
    @Inject(MAILER) private readonly mailer: Mailer,
    private readonly configService: ConfigService,
    private readonly usersServiceClient: UsersServiceClient,
  ) {
    this.socialVerifiers = {
      [SocialAuthProvider.GOOGLE]: googleTokenVerifier,
      [SocialAuthProvider.APPLE]: appleTokenVerifier,
    };
  }

  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    const existing = await this.identityService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email đã được sử dụng');
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    const user = await this.identityService.create({
      email: dto.email,
      passwordHash,
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      provider: AuthProvider.LOCAL,
    });

    await this.createProfileOrCompensate(user, dto.display_name);

    await this.sendVerificationEmail(user.id, user.email);

    return toRegisterResponse(user);
  }

  /**
   * Tạo hồ sơ bên users-service ngay sau khi vừa tạo identity (register,
   * social login tài khoản mới). Nếu fail: dọn cả 2 phía thay vì để lại
   * tài khoản "mồ côi" — xoá luôn profile vừa tạo bên users-service
   * (best-effort, phòng trường hợp call tạo thực ra đã thành công nhưng
   * response bị mất) và soft-delete identity vừa tạo. Lỗi ở chính bước
   * soft-delete không được nuốt mất lỗi gốc — vẫn throw lỗi gốc cho
   * client, chỉ log thêm để biết cần can thiệp thủ công.
   */
  private async createProfileOrCompensate(
    user: User,
    displayName: string,
  ): Promise<void> {
    try {
      await this.usersServiceClient.createProfile({
        userId: user.id,
        role: user.role,
        identityCreatedAt: user.createdAt,
        displayName,
      });
    } catch (error) {
      await this.usersServiceClient.deleteProfile(user.id);
      try {
        await this.identityService.softDelete(user.id);
      } catch (softDeleteError) {
        this.logger.error(
          `Tạo profile thất bại VÀ compensate (soft-delete identity) cũng thất bại — cần can thiệp thủ công, userId=${user.id}`,
          softDeleteError instanceof Error
            ? softDeleteError.stack
            : String(softDeleteError),
        );
      }
      this.logger.error(
        `Đăng ký thất bại: không tạo được profile bên users-service, đã compensate — userId=${user.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new ServiceUnavailableException(
        'Đăng ký thất bại, vui lòng thử lại sau',
      );
    }
  }

  private async sendVerificationEmail(
    userId: string,
    email: string,
  ): Promise<void> {
    const token = this.emailVerificationTokenService.sign(userId);
    // Domain FE xác thực email chưa chốt — dùng FE_BASE_URL nếu đã cấu
    // hình, fallback về placeholder rõ ràng thay vì đoán bừa 1 domain.
    const feBaseUrl = this.configService.get<string>(
      'FE_BASE_URL',
      '<FE_BASE_URL_CHUA_CAU_HINH>',
    );
    const verifyLink = `${feBaseUrl}/verify-email?token=${token}`;
    await this.mailer.send({
      to: email,
      subject: 'Xác thực email tài khoản Tâm An',
      text: `Nhấn vào link sau để xác thực email (hết hạn sau 24h): ${verifyLink}`,
    });
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<{ message: string }> {
    const userId = this.emailVerificationTokenService.verifyAndGetUserId(
      dto.token,
    );
    const user = await this.identityService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Token xác thực email không hợp lệ');
    }

    // "Đã dùng" được xác định qua chính field email_verified_at trên user
    // — không cần bảng lưu token riêng. Token JWT vẫn còn hạn (24h) nên
    // verify lần 2 sẽ rơi vào đây thay vì set lại thành công.
    if (user.emailVerifiedAt) {
      throw new ConflictException('Email đã được xác thực trước đó');
    }

    await this.identityService.markEmailVerified(userId);

    return { message: 'Xác thực email thành công' };
  }

  async resendVerificationEmail(userId: string): Promise<{ message: string }> {
    const user = await this.identityService.findById(userId);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Phiên đăng nhập không còn hiệu lực');
    }
    if (user.emailVerifiedAt) {
      throw new ConflictException(
        'Email đã được xác thực trước đó, không cần gửi lại',
      );
    }

    await this.sendVerificationEmail(user.id, user.email);

    return { message: 'Đã gửi lại email xác thực' };
  }

  async login(
    dto: LoginDto,
    deviceInfo: string | null,
  ): Promise<LoginResponseDto> {
    const user = await this.identityService.findByEmail(dto.email);

    // Cùng 1 lỗi 401 chung cho mọi trường hợp: user không tồn tại, sai mật
    // khẩu, tài khoản không active, hoặc tài khoản chỉ đăng nhập social
    // (passwordHash null) — không tiết lộ trường hợp nào đang xảy ra.
    if (!user || !user.passwordHash || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const passwordMatches = await argon2.verify(
      user.passwordHash,
      dto.password,
    );
    if (!passwordMatches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }

    const { accessToken, refreshToken } =
      await this.tokenService.issueTokenPair(user, deviceInfo);

    return toLoginResponse(user, accessToken, refreshToken);
  }

  async me(userId: string): Promise<AuthMeResponseDto> {
    const user = await this.identityService.findById(userId);

    // Token còn hợp lệ nhưng user đã bị xoá/suspend sau khi token phát
    // hành — coi như phiên không còn hiệu lực, trả 401 giống token hỏng
    // (nhất quán với cách #11 ẩn tài khoản suspended).
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Phiên đăng nhập không còn hiệu lực');
    }

    return toAuthMeResponse(user);
  }

  async logout(userId: string, dto: LogoutDto): Promise<{ message: string }> {
    await this.tokenService.revokeByUserAndToken(userId, dto.refresh_token);
    // Luôn trả 200 (idempotent) kể cả khi token không tồn tại/đã bị thu
    // hồi trước đó — không tiết lộ trạng thái token qua response.
    return { message: 'Đăng xuất thành công' };
  }

  async refresh(
    dto: RefreshDto,
    deviceInfo: string | null,
  ): Promise<RefreshResponseDto> {
    const pair = await this.tokenService.rotateRefreshToken(
      dto.refresh_token,
      deviceInfo,
    );
    return toRefreshResponse(pair);
  }

  async socialLogin(
    dto: SocialLoginDto,
    deviceInfo: string | null,
  ): Promise<LoginResponseDto> {
    const provider =
      dto.provider === SocialAuthProvider.GOOGLE
        ? AuthProvider.GOOGLE
        : AuthProvider.APPLE;
    const verified = await this.socialVerifiers[dto.provider].verify(
      dto.id_token,
    );

    let user = await this.identityService.findByProviderAndProviderId(
      provider,
      verified.providerId,
    );

    if (!user) {
      const existingByEmail = await this.identityService.findByEmail(
        verified.email,
      );
      if (existingByEmail) {
        // Quyết định PO còn để ngỏ trong issue gốc ("liên kết tài khoản
        // hay từ chối"): chọn TỪ CHỐI thay vì tự động liên kết ngầm định
        // — an toàn hơn (tránh chiếm đoạt tài khoản qua email trùng khi
        // chưa xác thực chủ sở hữu thật sự), đổi lại UX kém hơn. Cần PO
        // xác nhận nếu muốn đổi sang auto-link.
        throw new ConflictException(
          existingByEmail.provider === AuthProvider.LOCAL
            ? 'Email này đã được đăng ký bằng email/password. Vui lòng đăng nhập bằng email/password.'
            : 'Email này đã được liên kết với một tài khoản social khác.',
        );
      }

      user = await this.identityService.create({
        email: verified.email,
        passwordHash: null,
        role: UserRole.USER,
        status: UserStatus.ACTIVE,
        provider,
        providerId: verified.providerId,
      });

      // Apple thường không trả tên trong idToken — fallback về phần đầu
      // email, người dùng có thể đổi lại qua PATCH /users/me (#12).
      await this.createProfileOrCompensate(
        user,
        verified.displayName ?? verified.email.split('@')[0],
      );
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Tài khoản không khả dụng');
    }

    const { accessToken, refreshToken } =
      await this.tokenService.issueTokenPair(user, deviceInfo);

    return toLoginResponse(user, accessToken, refreshToken);
  }

  async deleteMe(userId: string): Promise<{ message: string }> {
    const user = await this.identityService.findById(userId);
    // Route cố định /auth/me — Owner luôn là chính user trong token.
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Phiên đăng nhập không còn hiệu lực');
    }

    // Soft delete: giữ lại dữ liệu tương tác lịch sử (posts/comments ở
    // các sprint sau) qua deleted_at, không xoá cứng.
    await this.identityService.softDelete(userId);

    // Thu hồi toàn bộ refresh token -> đăng xuất khỏi mọi thiết bị ngay
    // lập tức, không chờ access token hết hạn tự nhiên.
    await this.tokenService.revokeAllForUser(userId);

    // Dọn hồ sơ bên users-service — best-effort, không ảnh hưởng response
    // (phía identity đã xoá xong, đó mới là điều quan trọng với client).
    await this.usersServiceClient.deleteProfile(userId);

    return { message: 'Tài khoản đã được xoá' };
  }

  getJwks(): { keys: SigningJwk[] } {
    return this.tokenService.getJwks();
  }
}
