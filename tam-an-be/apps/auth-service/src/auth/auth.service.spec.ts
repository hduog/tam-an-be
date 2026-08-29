import {
  ConflictException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { UserRole, UserStatus } from '@shared-auth';
import { AuthProvider, User } from '../identity/user.entity';
import { IdentityService } from '../identity/identity.service';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SocialAuthProvider, SocialLoginDto } from './dto/social-login.dto';
import { TokenService } from './token.service';
import { GoogleTokenVerifierService } from './social/google-token-verifier.service';
import { AppleTokenVerifierService } from './social/apple-token-verifier.service';
import { SocialTokenVerifier } from './interfaces/social-token-verifier.interface';
import { EmailVerificationTokenService } from './email-verification-token.service';
import { MAILER } from './mailer/mailer.token';
import type { Mailer } from './interfaces/mailer.interface';
import { UsersServiceClient } from './internal/users-service-client';

describe('AuthService', () => {
  let service: AuthService;
  let identityService: jest.Mocked<
    Pick<
      IdentityService,
      | 'findByEmail'
      | 'create'
      | 'findById'
      | 'findByProviderAndProviderId'
      | 'markEmailVerified'
      | 'softDelete'
    >
  >;
  let tokenService: jest.Mocked<
    Pick<
      TokenService,
      | 'issueTokenPair'
      | 'revokeByUserAndToken'
      | 'rotateRefreshToken'
      | 'revokeAllForUser'
    >
  >;
  let googleVerifier: jest.Mocked<SocialTokenVerifier>;
  let appleVerifier: jest.Mocked<SocialTokenVerifier>;
  let emailVerificationTokenService: jest.Mocked<
    Pick<EmailVerificationTokenService, 'sign' | 'verifyAndGetUserId'>
  >;
  let mailer: jest.Mocked<Mailer>;
  let usersServiceClient: jest.Mocked<
    Pick<UsersServiceClient, 'createProfile' | 'deleteProfile'>
  >;

  const registerDto: RegisterDto = {
    email: 'new.user@tam-an.dev',
    password: 'Passw0rd123',
    display_name: 'Người dùng Mới',
  };

  const buildUser = (overrides: Partial<User> = {}): User => {
    const user = new User();
    Object.assign(user, {
      id: 'user-id-1',
      email: 'existing.user@tam-an.dev',
      passwordHash: null,
      role: UserRole.USER,
      provider: AuthProvider.LOCAL,
      providerId: null,
      emailVerifiedAt: null,
      status: UserStatus.ACTIVE,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      deletedAt: null,
      ...overrides,
    });
    return user;
  };

  beforeEach(async () => {
    identityService = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      findByProviderAndProviderId: jest.fn(),
      markEmailVerified: jest.fn(),
      softDelete: jest.fn(),
    };
    tokenService = {
      issueTokenPair: jest.fn(),
      revokeByUserAndToken: jest.fn(),
      rotateRefreshToken: jest.fn(),
      revokeAllForUser: jest.fn(),
    };
    googleVerifier = { verify: jest.fn() };
    appleVerifier = { verify: jest.fn() };
    emailVerificationTokenService = {
      sign: jest.fn().mockReturnValue('signed-verify-email-token'),
      verifyAndGetUserId: jest.fn(),
    };
    mailer = { send: jest.fn().mockResolvedValue(undefined) };
    usersServiceClient = {
      createProfile: jest.fn().mockResolvedValue(undefined),
      deleteProfile: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: IdentityService, useValue: identityService },
        { provide: TokenService, useValue: tokenService },
        { provide: GoogleTokenVerifierService, useValue: googleVerifier },
        { provide: AppleTokenVerifierService, useValue: appleVerifier },
        {
          provide: EmailVerificationTokenService,
          useValue: emailVerificationTokenService,
        },
        { provide: MAILER, useValue: mailer },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('https://tam-an.dev') },
        },
        { provide: UsersServiceClient, useValue: usersServiceClient },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('đăng ký thành công: tạo user mới, hash password, không trả password_hash', async () => {
      identityService.findByEmail.mockResolvedValue(null);
      const createdUser = buildUser({
        email: registerDto.email,
        passwordHash: 'hashed-password',
      });
      identityService.create.mockResolvedValue(createdUser);

      const result = await service.register(registerDto);

      expect(identityService.findByEmail).toHaveBeenCalledWith(
        registerDto.email,
      );
      expect(identityService.create).toHaveBeenCalledTimes(1);
      const createArg = identityService.create.mock.calls[0][0];
      expect(createArg.email).toBe(registerDto.email);
      expect(createArg.role).toBe(UserRole.USER);
      expect(createArg.status).toBe(UserStatus.ACTIVE);
      expect(createArg.provider).toBe(AuthProvider.LOCAL);
      expect(createArg.passwordHash).not.toBe(registerDto.password);
      expect(createArg.passwordHash).toMatch(/^\$argon2id\$/);

      expect(result).toEqual({
        id: createdUser.id,
        email: createdUser.email,
        role: createdUser.role,
        status: createdUser.status,
        provider: createdUser.provider,
        email_verified_at: createdUser.emailVerifiedAt,
        created_at: createdUser.createdAt,
      });
      expect(
        (result as unknown as Record<string, unknown>).passwordHash,
      ).toBeUndefined();
      expect(
        (result as unknown as Record<string, unknown>).password_hash,
      ).toBeUndefined();

      // AC: tạo hồ sơ bên users-service TRƯỚC khi gửi email xác thực (nếu
      // fail thì không được gửi nhầm email cho tài khoản sắp compensate).
      expect(usersServiceClient.createProfile).toHaveBeenCalledWith({
        userId: createdUser.id,
        role: createdUser.role,
        identityCreatedAt: createdUser.createdAt,
        displayName: registerDto.display_name,
      });

      // AC: kích hoạt gửi email xác thực tự động sau khi đăng ký.
      expect(emailVerificationTokenService.sign).toHaveBeenCalledWith(
        createdUser.id,
      );
      expect(mailer.send).toHaveBeenCalledTimes(1);
      const mailArg = mailer.send.mock.calls[0][0];
      expect(mailArg.to).toBe(createdUser.email);
      expect(mailArg.text).toContain('signed-verify-email-token');
    });

    it('trùng email: ném ConflictException và không tạo user mới', async () => {
      identityService.findByEmail.mockResolvedValue({
        id: 'existing-id',
      } as User);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      expect(identityService.create).not.toHaveBeenCalled();
    });

    it('tạo profile bên users-service thất bại: compensate (xoá profile + soft-delete identity) và ném 503, không gửi email xác thực', async () => {
      identityService.findByEmail.mockResolvedValue(null);
      const createdUser = buildUser({ email: registerDto.email });
      identityService.create.mockResolvedValue(createdUser);
      usersServiceClient.createProfile.mockRejectedValue(
        new Error('users-service down'),
      );

      await expect(service.register(registerDto)).rejects.toThrow(
        ServiceUnavailableException,
      );

      expect(usersServiceClient.deleteProfile).toHaveBeenCalledWith(
        createdUser.id,
      );
      expect(identityService.softDelete).toHaveBeenCalledWith(createdUser.id);
      expect(emailVerificationTokenService.sign).not.toHaveBeenCalled();
      expect(mailer.send).not.toHaveBeenCalled();
    });

    it('tạo profile thất bại VÀ compensate (soft-delete) cũng thất bại: vẫn ném lỗi gốc 503 (không nuốt lỗi)', async () => {
      identityService.findByEmail.mockResolvedValue(null);
      const createdUser = buildUser({ email: registerDto.email });
      identityService.create.mockResolvedValue(createdUser);
      usersServiceClient.createProfile.mockRejectedValue(
        new Error('users-service down'),
      );
      identityService.softDelete.mockRejectedValue(new Error('db unreachable'));

      await expect(service.register(registerDto)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      email: 'existing.user@tam-an.dev',
      password: 'CorrectPassw0rd',
    };

    it('login thành công: trả access/refresh token + thông tin user, không có password_hash', async () => {
      const passwordHash = await argon2.hash(loginDto.password, {
        type: argon2.argon2id,
      });
      const user = buildUser({ passwordHash });
      identityService.findByEmail.mockResolvedValue(user);
      tokenService.issueTokenPair.mockResolvedValue({
        accessToken: 'access-token-value',
        refreshToken: 'refresh-token-value',
      });

      const result = await service.login(loginDto, 'jest-agent/1.0');

      expect(tokenService.issueTokenPair).toHaveBeenCalledWith(
        user,
        'jest-agent/1.0',
      );
      expect(result).toEqual({
        access_token: 'access-token-value',
        refresh_token: 'refresh-token-value',
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          status: user.status,
        },
      });
      expect(
        (result as unknown as Record<string, unknown>).password_hash,
      ).toBeUndefined();
    });

    it('sai mật khẩu: ném 401 với message chung, không phát hành token', async () => {
      const passwordHash = await argon2.hash('CorrectPassw0rd', {
        type: argon2.argon2id,
      });
      identityService.findByEmail.mockResolvedValue(
        buildUser({ passwordHash }),
      );

      await expect(
        service.login({ ...loginDto, password: 'WrongPassword' }, null),
      ).rejects.toThrow(UnauthorizedException);
      expect(tokenService.issueTokenPair).not.toHaveBeenCalled();
    });

    it('email không tồn tại: ném 401 (không tiết lộ email có tồn tại hay không)', async () => {
      identityService.findByEmail.mockResolvedValue(null);

      await expect(service.login(loginDto, null)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(tokenService.issueTokenPair).not.toHaveBeenCalled();
    });

    it('tài khoản suspended: ném 401, không phát hành token', async () => {
      const passwordHash = await argon2.hash(loginDto.password, {
        type: argon2.argon2id,
      });
      identityService.findByEmail.mockResolvedValue(
        buildUser({ passwordHash, status: UserStatus.SUSPENDED }),
      );

      await expect(service.login(loginDto, null)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(tokenService.issueTokenPair).not.toHaveBeenCalled();
    });

    it('tài khoản deleted: ném 401, không phát hành token', async () => {
      const passwordHash = await argon2.hash(loginDto.password, {
        type: argon2.argon2id,
      });
      identityService.findByEmail.mockResolvedValue(
        buildUser({ passwordHash, status: UserStatus.DELETED }),
      );

      await expect(service.login(loginDto, null)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(tokenService.issueTokenPair).not.toHaveBeenCalled();
    });

    it('tài khoản chỉ đăng nhập social (passwordHash null): ném 401, không crash', async () => {
      identityService.findByEmail.mockResolvedValue(
        buildUser({ passwordHash: null, provider: AuthProvider.GOOGLE }),
      );

      await expect(service.login(loginDto, null)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(tokenService.issueTokenPair).not.toHaveBeenCalled();
    });
  });

  describe('me', () => {
    it('trả đúng thông tin định danh, không có password_hash', async () => {
      const user = buildUser({
        email: 'me@tam-an.dev',
        emailVerifiedAt: new Date('2026-02-01T00:00:00Z'),
      });
      identityService.findById.mockResolvedValue(user);

      const result = await service.me(user.id);

      expect(identityService.findById).toHaveBeenCalledWith(user.id);
      expect(result).toEqual({
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.status,
        provider: user.provider,
        email_verified_at: user.emailVerifiedAt,
        created_at: user.createdAt,
      });
      expect(
        (result as unknown as Record<string, unknown>).password_hash,
      ).toBeUndefined();
    });

    it('user không còn tồn tại (đã bị xoá sau khi token phát hành): ném 401', async () => {
      identityService.findById.mockResolvedValue(null);

      await expect(service.me('deleted-user-id')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('user bị suspended sau khi token phát hành: ném 401', async () => {
      identityService.findById.mockResolvedValue(
        buildUser({ status: UserStatus.SUSPENDED }),
      );

      await expect(service.me('some-user-id')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('logout thành công: gọi revokeByUserAndToken và trả message ack', async () => {
      tokenService.revokeByUserAndToken.mockResolvedValue(undefined);

      const result = await service.logout('user-id-1', {
        refresh_token: 'some-refresh-token',
      });

      expect(tokenService.revokeByUserAndToken).toHaveBeenCalledWith(
        'user-id-1',
        'some-refresh-token',
      );
      expect(typeof result.message).toBe('string');
    });

    it('logout với token đã thu hồi trước đó: vẫn trả thành công (idempotent)', async () => {
      // TokenService tự xử lý idempotency (không throw) — AuthService chỉ
      // ủy quyền, luôn trả ack thành công bất kể trạng thái token.
      tokenService.revokeByUserAndToken.mockResolvedValue(undefined);

      const result = await service.logout('user-id-1', {
        refresh_token: 'already-revoked',
      });
      expect(typeof result.message).toBe('string');
    });
  });

  describe('refresh', () => {
    it('uỷ quyền cho TokenService.rotateRefreshToken và map đúng response', async () => {
      tokenService.rotateRefreshToken.mockResolvedValue({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });

      const result = await service.refresh(
        { refresh_token: 'old-refresh-token' },
        'jest-agent',
      );

      expect(tokenService.rotateRefreshToken).toHaveBeenCalledWith(
        'old-refresh-token',
        'jest-agent',
      );
      expect(result).toEqual({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
      });
    });

    it('token không hợp lệ/hết hạn/đã bị thu hồi: lỗi 401 được ném thẳng lên (không nuốt lỗi)', async () => {
      tokenService.rotateRefreshToken.mockRejectedValue(
        new UnauthorizedException('invalid'),
      );

      await expect(
        service.refresh({ refresh_token: 'bad-token' }, null),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('socialLogin', () => {
    const socialDto: SocialLoginDto = {
      provider: SocialAuthProvider.GOOGLE,
      id_token: 'raw-google-id-token',
    };

    it('token hợp lệ + tài khoản social đã tồn tại: đăng nhập vào tài khoản đó, không tạo mới', async () => {
      googleVerifier.verify.mockResolvedValue({
        providerId: 'google-sub-1',
        email: 'social.user@tam-an.dev',
      });
      const existing = buildUser({
        provider: AuthProvider.GOOGLE,
        providerId: 'google-sub-1',
        email: 'social.user@tam-an.dev',
      });
      identityService.findByProviderAndProviderId.mockResolvedValue(existing);
      tokenService.issueTokenPair.mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
      });

      const result = await service.socialLogin(socialDto, null);

      expect(identityService.findByProviderAndProviderId).toHaveBeenCalledWith(
        AuthProvider.GOOGLE,
        'google-sub-1',
      );
      expect(identityService.create).not.toHaveBeenCalled();
      expect(usersServiceClient.createProfile).not.toHaveBeenCalled();
      expect(tokenService.issueTokenPair).toHaveBeenCalledWith(existing, null);
      expect(result.access_token).toBe('at');
    });

    it('token hợp lệ + chưa từng đăng nhập social này, email cũng chưa tồn tại: tạo user mới với passwordHash=null', async () => {
      googleVerifier.verify.mockResolvedValue({
        providerId: 'google-sub-new',
        email: 'brand.new@tam-an.dev',
        displayName: 'Người Mới Từ Google',
      });
      identityService.findByProviderAndProviderId.mockResolvedValue(null);
      identityService.findByEmail.mockResolvedValue(null);
      const createdUser = buildUser({
        provider: AuthProvider.GOOGLE,
        providerId: 'google-sub-new',
        email: 'brand.new@tam-an.dev',
        passwordHash: null,
      });
      identityService.create.mockResolvedValue(createdUser);
      tokenService.issueTokenPair.mockResolvedValue({
        accessToken: 'at2',
        refreshToken: 'rt2',
      });

      await service.socialLogin(socialDto, 'device-x');

      expect(identityService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'brand.new@tam-an.dev',
          passwordHash: null,
          provider: AuthProvider.GOOGLE,
          providerId: 'google-sub-new',
        }),
      );
      // AC: tạo profile bên users-service cho tài khoản social mới, dùng
      // displayName từ provider khi có.
      expect(usersServiceClient.createProfile).toHaveBeenCalledWith({
        userId: createdUser.id,
        role: createdUser.role,
        identityCreatedAt: createdUser.createdAt,
        displayName: 'Người Mới Từ Google',
      });
    });

    it('provider không trả displayName (Apple thường vậy): fallback về phần đầu email khi tạo profile', async () => {
      googleVerifier.verify.mockResolvedValue({
        providerId: 'google-sub-no-name',
        email: 'no.name@tam-an.dev',
      });
      identityService.findByProviderAndProviderId.mockResolvedValue(null);
      identityService.findByEmail.mockResolvedValue(null);
      const createdUser = buildUser({
        provider: AuthProvider.GOOGLE,
        providerId: 'google-sub-no-name',
        email: 'no.name@tam-an.dev',
        passwordHash: null,
      });
      identityService.create.mockResolvedValue(createdUser);
      tokenService.issueTokenPair.mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
      });

      await service.socialLogin(socialDto, null);

      expect(usersServiceClient.createProfile).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: 'no.name' }),
      );
    });

    it('tạo profile bên users-service thất bại (tài khoản social mới): compensate và ném 503', async () => {
      googleVerifier.verify.mockResolvedValue({
        providerId: 'google-sub-fail',
        email: 'fail.case@tam-an.dev',
      });
      identityService.findByProviderAndProviderId.mockResolvedValue(null);
      identityService.findByEmail.mockResolvedValue(null);
      const createdUser = buildUser({
        provider: AuthProvider.GOOGLE,
        providerId: 'google-sub-fail',
        email: 'fail.case@tam-an.dev',
        passwordHash: null,
      });
      identityService.create.mockResolvedValue(createdUser);
      usersServiceClient.createProfile.mockRejectedValue(
        new Error('users-service down'),
      );

      await expect(service.socialLogin(socialDto, null)).rejects.toThrow(
        ServiceUnavailableException,
      );

      expect(usersServiceClient.deleteProfile).toHaveBeenCalledWith(
        createdUser.id,
      );
      expect(identityService.softDelete).toHaveBeenCalledWith(createdUser.id);
      expect(tokenService.issueTokenPair).not.toHaveBeenCalled();
    });

    it('email đã đăng ký bằng local account: ném 409, không tạo user mới, không phát hành token', async () => {
      googleVerifier.verify.mockResolvedValue({
        providerId: 'google-sub-x',
        email: 'local.user@tam-an.dev',
      });
      identityService.findByProviderAndProviderId.mockResolvedValue(null);
      identityService.findByEmail.mockResolvedValue(
        buildUser({ provider: AuthProvider.LOCAL }),
      );

      await expect(service.socialLogin(socialDto, null)).rejects.toThrow(
        ConflictException,
      );
      expect(identityService.create).not.toHaveBeenCalled();
      expect(tokenService.issueTokenPair).not.toHaveBeenCalled();
    });

    it('email đã liên kết với social provider khác: ném 409', async () => {
      googleVerifier.verify.mockResolvedValue({
        providerId: 'google-sub-y',
        email: 'apple.user@tam-an.dev',
      });
      identityService.findByProviderAndProviderId.mockResolvedValue(null);
      identityService.findByEmail.mockResolvedValue(
        buildUser({ provider: AuthProvider.APPLE, providerId: 'apple-sub' }),
      );

      await expect(service.socialLogin(socialDto, null)).rejects.toThrow(
        ConflictException,
      );
      expect(identityService.create).not.toHaveBeenCalled();
    });

    it('idToken không hợp lệ/hết hạn: lỗi từ verifier được ném thẳng lên, không gọi IdentityService', async () => {
      googleVerifier.verify.mockRejectedValue(
        new UnauthorizedException(
          'Google idToken không hợp lệ hoặc đã hết hạn',
        ),
      );

      await expect(service.socialLogin(socialDto, null)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(
        identityService.findByProviderAndProviderId,
      ).not.toHaveBeenCalled();
    });

    it('tài khoản social đã tồn tại nhưng không active (suspended/deleted): ném 401', async () => {
      googleVerifier.verify.mockResolvedValue({
        providerId: 'google-sub-1',
        email: 'suspended@tam-an.dev',
      });
      identityService.findByProviderAndProviderId.mockResolvedValue(
        buildUser({ status: UserStatus.SUSPENDED }),
      );

      await expect(service.socialLogin(socialDto, null)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(tokenService.issueTokenPair).not.toHaveBeenCalled();
    });

    it('provider apple: dùng đúng AppleTokenVerifierService, không phải Google', async () => {
      appleVerifier.verify.mockResolvedValue({
        providerId: 'apple-sub-1',
        email: 'apple.new@tam-an.dev',
      });
      identityService.findByProviderAndProviderId.mockResolvedValue(null);
      identityService.findByEmail.mockResolvedValue(null);
      identityService.create.mockResolvedValue(
        buildUser({ provider: AuthProvider.APPLE, providerId: 'apple-sub-1' }),
      );
      tokenService.issueTokenPair.mockResolvedValue({
        accessToken: 'at3',
        refreshToken: 'rt3',
      });

      await service.socialLogin(
        { provider: SocialAuthProvider.APPLE, id_token: 'raw-apple-id-token' },
        null,
      );

      expect(appleVerifier.verify).toHaveBeenCalledWith('raw-apple-id-token');
      expect(googleVerifier.verify).not.toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    it('token hợp lệ + chưa xác thực trước đó: verify thành công, set email_verified_at', async () => {
      emailVerificationTokenService.verifyAndGetUserId.mockReturnValue(
        'user-id-1',
      );
      identityService.findById.mockResolvedValue(
        buildUser({ emailVerifiedAt: null }),
      );

      const result = await service.verifyEmail({ token: 'valid-token' });

      expect(
        emailVerificationTokenService.verifyAndGetUserId,
      ).toHaveBeenCalledWith('valid-token');
      expect(identityService.markEmailVerified).toHaveBeenCalledWith(
        'user-id-1',
      );
      expect(typeof result.message).toBe('string');
    });

    it('token không hợp lệ/hết hạn: lỗi từ EmailVerificationTokenService được ném thẳng lên', async () => {
      emailVerificationTokenService.verifyAndGetUserId.mockImplementation(
        () => {
          throw new UnauthorizedException('Token xác thực email không hợp lệ');
        },
      );

      await expect(service.verifyEmail({ token: 'bad-token' })).rejects.toThrow(
        UnauthorizedException,
      );
      expect(identityService.markEmailVerified).not.toHaveBeenCalled();
    });

    it('user trong token không còn tồn tại: ném 401', async () => {
      emailVerificationTokenService.verifyAndGetUserId.mockReturnValue(
        'deleted-user-id',
      );
      identityService.findById.mockResolvedValue(null);

      await expect(
        service.verifyEmail({ token: 'valid-token-deleted-user' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(identityService.markEmailVerified).not.toHaveBeenCalled();
    });

    it('verify 2 lần (token vẫn còn hạn nhưng email đã xác thực trước đó): ném 409, không set lại', async () => {
      emailVerificationTokenService.verifyAndGetUserId.mockReturnValue(
        'user-id-1',
      );
      identityService.findById.mockResolvedValue(
        buildUser({ emailVerifiedAt: new Date('2026-01-02T00:00:00Z') }),
      );

      await expect(
        service.verifyEmail({ token: 'already-used-token' }),
      ).rejects.toThrow(ConflictException);
      expect(identityService.markEmailVerified).not.toHaveBeenCalled();
    });
  });

  describe('resendVerificationEmail', () => {
    it('chưa xác thực: gửi lại thành công, sinh token mới', async () => {
      identityService.findById.mockResolvedValue(
        buildUser({ emailVerifiedAt: null }),
      );
      emailVerificationTokenService.sign.mockReturnValue('new-token');

      const result = await service.resendVerificationEmail('user-id-1');

      expect(emailVerificationTokenService.sign).toHaveBeenCalledWith(
        'user-id-1',
      );
      expect(mailer.send).toHaveBeenCalledTimes(1);
      expect(typeof result.message).toBe('string');
    });

    it('email đã xác thực trước đó: ném 409, không gửi lại', async () => {
      identityService.findById.mockResolvedValue(
        buildUser({ emailVerifiedAt: new Date() }),
      );

      await expect(
        service.resendVerificationEmail('user-id-1'),
      ).rejects.toThrow(ConflictException);
      expect(mailer.send).not.toHaveBeenCalled();
    });

    it('phiên không còn hiệu lực (user không tồn tại/không active): ném 401', async () => {
      identityService.findById.mockResolvedValue(null);

      await expect(
        service.resendVerificationEmail('unknown-id'),
      ).rejects.toThrow(UnauthorizedException);
      expect(mailer.send).not.toHaveBeenCalled();
    });
  });

  describe('deleteMe', () => {
    it('xoá thành công: soft-delete identity + thu hồi toàn bộ refresh token', async () => {
      identityService.findById.mockResolvedValue(buildUser());
      identityService.softDelete.mockResolvedValue(undefined);
      tokenService.revokeAllForUser.mockResolvedValue(undefined);

      const result = await service.deleteMe('user-id-1');

      expect(identityService.softDelete).toHaveBeenCalledWith('user-id-1');
      expect(tokenService.revokeAllForUser).toHaveBeenCalledWith('user-id-1');
      expect(usersServiceClient.deleteProfile).toHaveBeenCalledWith(
        'user-id-1',
      );
      expect(typeof result.message).toBe('string');
    });

    it('phiên không còn hiệu lực (user không tồn tại/không active): ném 401', async () => {
      identityService.findById.mockResolvedValue(null);

      await expect(service.deleteMe('unknown-id')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(identityService.softDelete).not.toHaveBeenCalled();
      expect(usersServiceClient.deleteProfile).not.toHaveBeenCalled();
    });
  });
});
