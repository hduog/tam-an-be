import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import { AuthProvider, User, UserRole, UserStatus } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { TokenService } from './token.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<
    Pick<UsersService, 'findByEmail' | 'create' | 'findById'>
  >;
  let tokenService: jest.Mocked<
    Pick<
      TokenService,
      'issueTokenPair' | 'revokeByUserAndToken' | 'rotateRefreshToken'
    >
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
    };
    tokenService = {
      issueTokenPair: jest.fn(),
      revokeByUserAndToken: jest.fn(),
      rotateRefreshToken: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: TokenService, useValue: tokenService },
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
});
