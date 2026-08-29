import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthProvider, UserRole, UserStatus } from '../users/user.entity';
import { UsersService } from '../users/users.service';
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
import { TokenService } from './token.service';

// Message cố tình chung chung cho mọi lý do đăng nhập thất bại (sai email,
// sai mật khẩu, tài khoản suspended/deleted, account chỉ đăng nhập social)
// — không tiết lộ lý do cụ thể, tránh lộ email có tồn tại trong hệ thống.
const INVALID_CREDENTIALS_MESSAGE = 'Email hoặc mật khẩu không đúng';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly tokenService: TokenService,
  ) {}

  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email đã được sử dụng');
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      displayName: dto.display_name,
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      provider: AuthProvider.LOCAL,
    });

    // Issue #07 chưa triển khai luồng gửi email xác thực thật (không có
    // MailerService/token table trong codebase). Log lại để không âm thầm
    // bỏ qua acceptance criteria; thay thế bằng luồng thật khi #07 hoàn thành.
    this.logger.log(
      `TODO(#7): gửi email xác thực cho user ${user.id} (${user.email})`,
    );

    return toRegisterResponse(user);
  }

  async login(
    dto: LoginDto,
    deviceInfo: string | null,
  ): Promise<LoginResponseDto> {
    const user = await this.usersService.findByEmail(dto.email);

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
    const user = await this.usersService.findById(userId);

    // Token còn hợp lệ nhưng user đã bị xoá/suspend sau khi token phát
    // hành — coi như phiên không còn hiệu lực, trả 401 giống token hỏng
    // (nhất quán với cách #11 ẩn tài khoản suspended).
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Phiên đăng nhập không còn hiệu lực');
    }

    return toAuthMeResponse(user);
  }
}
