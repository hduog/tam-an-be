import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { AuthProvider, User, UserRole, UserStatus } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SocialAuthProvider, SocialLoginDto } from './dto/social-login.dto';
import { TokenService } from './token.service';
import { GoogleTokenVerifierService } from './social/google-token-verifier.service';
import { AppleTokenVerifierService } from './social/apple-token-verifier.service';
import { SocialTokenVerifier } from './interfaces/social-token-verifier.interface';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<
    Pick<
      UsersService,
      'findByEmail' | 'create' | 'findById' | 'findByProviderAndProviderId'
    >
  >;
  let tokenService: jest.Mocked<
    Pick<
      TokenService,
      'issueTokenPair' | 'revokeByUserAndToken' | 'rotateRefreshToken'
    >
  >;
  let googleVerifier: jest.Mocked<SocialTokenVerifier>;
  let appleVerifier: jest.Mocked<SocialTokenVerifier>;

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
      displayName: 'Người dùng',
      username: null,
      avatarUrl: null,
      bio: null,
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
    usersService = {
      findByEmail: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      findByProviderAndProviderId: jest.fn(),
    };
    tokenService = {
      issueTokenPair: jest.fn(),
      revokeByUserAndToken: jest.fn(),
      rotateRefreshToken: jest.fn(),
    };
    googleVerifier = { verify: jest.fn() };
    appleVerifier = { verify: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: TokenService, useValue: tokenService },
        { provide: GoogleTokenVerifierService, useValue: googleVerifier },
        { provide: AppleTokenVerifierService, useValue: appleVerifier },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('register', () => {
    it('đăng ký thành công: tạo user mới, hash password, không trả password_hash', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      const createdUser = buildUser({
        email: registerDto.email,
        passwordHash: 'hashed-password',
        displayName: registerDto.display_name,
      });
      usersService.create.mockResolvedValue(createdUser);

      const result = await service.register(registerDto);

      expect(usersService.findByEmail).toHaveBeenCalledWith(registerDto.email);
      expect(usersService.create).toHaveBeenCalledTimes(1);
      const createArg = usersService.create.mock.calls[0][0];
      expect(createArg.email).toBe(registerDto.email);
      expect(createArg.displayName).toBe(registerDto.display_name);
      expect(createArg.role).toBe(UserRole.USER);
      expect(createArg.status).toBe(UserStatus.ACTIVE);
      expect(createArg.provider).toBe(AuthProvider.LOCAL);
      expect(createArg.passwordHash).not.toBe(registerDto.password);
      expect(createArg.passwordHash).toMatch(/^\$argon2id\$/);

      expect(result).toEqual({
        id: createdUser.id,
        email: createdUser.email,
        display_name: createdUser.displayName,
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
    });

    it('trùng email: ném ConflictException và không tạo user mới', async () => {
      usersService.findByEmail.mockResolvedValue({
        id: 'existing-id',
      } as User);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
      expect(usersService.create).not.toHaveBeenCalled();
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
      usersService.findByEmail.mockResolvedValue(user);
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
          display_name: user.displayName,
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
      usersService.findByEmail.mockResolvedValue(buildUser({ passwordHash }));

      await expect(
        service.login({ ...loginDto, password: 'WrongPassword' }, null),
      ).rejects.toThrow(UnauthorizedException);
      expect(tokenService.issueTokenPair).not.toHaveBeenCalled();
    });

    it('email không tồn tại: ném 401 (không tiết lộ email có tồn tại hay không)', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(service.login(loginDto, null)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(tokenService.issueTokenPair).not.toHaveBeenCalled();
    });

    it('tài khoản suspended: ném 401, không phát hành token', async () => {
      const passwordHash = await argon2.hash(loginDto.password, {
        type: argon2.argon2id,
      });
      usersService.findByEmail.mockResolvedValue(
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
      usersService.findByEmail.mockResolvedValue(
        buildUser({ passwordHash, status: UserStatus.DELETED }),
      );

      await expect(service.login(loginDto, null)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(tokenService.issueTokenPair).not.toHaveBeenCalled();
    });

    it('tài khoản chỉ đăng nhập social (passwordHash null): ném 401, không crash', async () => {
      usersService.findByEmail.mockResolvedValue(
        buildUser({ passwordHash: null, provider: AuthProvider.GOOGLE }),
      );

      await expect(service.login(loginDto, null)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(tokenService.issueTokenPair).not.toHaveBeenCalled();
    });
  });

  describe('me', () => {
    it('trả đúng thông tin user, không có password_hash', async () => {
      const user = buildUser({
        email: 'me@tam-an.dev',
        username: 'me_user',
        avatarUrl: 'https://cdn.tam-an.dev/avatars/me.png',
        bio: 'hello',
        emailVerifiedAt: new Date('2026-02-01T00:00:00Z'),
      });
      usersService.findById.mockResolvedValue(user);

      const result = await service.me(user.id);

      expect(usersService.findById).toHaveBeenCalledWith(user.id);
      expect(result).toEqual({
        id: user.id,
        email: user.email,
        role: user.role,
        display_name: user.displayName,
        username: user.username,
        avatar_url: user.avatarUrl,
        bio: user.bio,
        email_verified_at: user.emailVerifiedAt,
        status: user.status,
      });
      expect(
        (result as unknown as Record<string, unknown>).password_hash,
      ).toBeUndefined();
    });

    it('user không còn tồn tại (đã bị xoá sau khi token phát hành): ném 401', async () => {
      usersService.findById.mockResolvedValue(null);

      await expect(service.me('deleted-user-id')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('user bị suspended sau khi token phát hành: ném 401', async () => {
      usersService.findById.mockResolvedValue(
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
      usersService.findByProviderAndProviderId.mockResolvedValue(existing);
      tokenService.issueTokenPair.mockResolvedValue({
        accessToken: 'at',
        refreshToken: 'rt',
      });

      const result = await service.socialLogin(socialDto, null);

      expect(usersService.findByProviderAndProviderId).toHaveBeenCalledWith(
        AuthProvider.GOOGLE,
        'google-sub-1',
      );
      expect(usersService.create).not.toHaveBeenCalled();
      expect(tokenService.issueTokenPair).toHaveBeenCalledWith(existing, null);
      expect(result.access_token).toBe('at');
    });

    it('token hợp lệ + chưa từng đăng nhập social này, email cũng chưa tồn tại: tạo user mới với passwordHash=null', async () => {
      googleVerifier.verify.mockResolvedValue({
        providerId: 'google-sub-new',
        email: 'brand.new@tam-an.dev',
        displayName: 'Người Mới Từ Google',
      });
      usersService.findByProviderAndProviderId.mockResolvedValue(null);
      usersService.findByEmail.mockResolvedValue(null);
      const createdUser = buildUser({
        provider: AuthProvider.GOOGLE,
        providerId: 'google-sub-new',
        email: 'brand.new@tam-an.dev',
        passwordHash: null,
        displayName: 'Người Mới Từ Google',
      });
      usersService.create.mockResolvedValue(createdUser);
      tokenService.issueTokenPair.mockResolvedValue({
        accessToken: 'at2',
        refreshToken: 'rt2',
      });

      await service.socialLogin(socialDto, 'device-x');

      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'brand.new@tam-an.dev',
          passwordHash: null,
          provider: AuthProvider.GOOGLE,
          providerId: 'google-sub-new',
          displayName: 'Người Mới Từ Google',
        }),
      );
    });

    it('email đã đăng ký bằng local account: ném 409, không tạo user mới, không phát hành token', async () => {
      googleVerifier.verify.mockResolvedValue({
        providerId: 'google-sub-x',
        email: 'local.user@tam-an.dev',
      });
      usersService.findByProviderAndProviderId.mockResolvedValue(null);
      usersService.findByEmail.mockResolvedValue(
        buildUser({ provider: AuthProvider.LOCAL }),
      );

      await expect(service.socialLogin(socialDto, null)).rejects.toThrow(
        ConflictException,
      );
      expect(usersService.create).not.toHaveBeenCalled();
      expect(tokenService.issueTokenPair).not.toHaveBeenCalled();
    });

    it('email đã liên kết với social provider khác: ném 409', async () => {
      googleVerifier.verify.mockResolvedValue({
        providerId: 'google-sub-y',
        email: 'apple.user@tam-an.dev',
      });
      usersService.findByProviderAndProviderId.mockResolvedValue(null);
      usersService.findByEmail.mockResolvedValue(
        buildUser({ provider: AuthProvider.APPLE, providerId: 'apple-sub' }),
      );

      await expect(service.socialLogin(socialDto, null)).rejects.toThrow(
        ConflictException,
      );
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('idToken không hợp lệ/hết hạn: lỗi từ verifier được ném thẳng lên, không gọi UsersService', async () => {
      googleVerifier.verify.mockRejectedValue(
        new UnauthorizedException(
          'Google idToken không hợp lệ hoặc đã hết hạn',
        ),
      );

      await expect(service.socialLogin(socialDto, null)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(usersService.findByProviderAndProviderId).not.toHaveBeenCalled();
    });

    it('tài khoản social đã tồn tại nhưng không active (suspended/deleted): ném 401', async () => {
      googleVerifier.verify.mockResolvedValue({
        providerId: 'google-sub-1',
        email: 'suspended@tam-an.dev',
      });
      usersService.findByProviderAndProviderId.mockResolvedValue(
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
      usersService.findByProviderAndProviderId.mockResolvedValue(null);
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue(
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
});
