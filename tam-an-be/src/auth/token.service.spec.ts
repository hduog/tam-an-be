import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RefreshToken } from '../users/refresh-token.entity';
import { AuthProvider, User, UserRole, UserStatus } from '../users/user.entity';
import { TokenService } from './token.service';

describe('TokenService', () => {
  let service: TokenService;
  let jwtService: jest.Mocked<Pick<JwtService, 'sign'>>;
  let repository: jest.Mocked<
    Pick<Repository<RefreshToken>, 'create' | 'save' | 'findOne'>
  >;

  const user: User = Object.assign(new User(), {
    id: 'user-id-1',
    email: 'user@tam-an.dev',
    passwordHash: 'hash',
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
  });

  beforeEach(async () => {
    jwtService = { sign: jest.fn().mockReturnValue('signed-access-token') };
    repository = {
      create: jest.fn((data) => data as RefreshToken),
      save: jest.fn((entity) => Promise.resolve(entity as RefreshToken)),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: JwtService, useValue: jwtService },
        { provide: getRepositoryToken(RefreshToken), useValue: repository },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
  });

  it('sinh access token qua JwtService với payload { sub, role }', async () => {
    await service.issueTokenPair(user, 'jest-agent');

    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: user.id,
      role: user.role,
    });
  });

  it('sinh refresh token ngẫu nhiên và lưu token_hash (không lưu plain token)', async () => {
    const result = await service.issueTokenPair(user, 'jest-agent');

    expect(result.accessToken).toBe('signed-access-token');
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(result.refreshToken.length).toBeGreaterThanOrEqual(64);

    expect(repository.create).toHaveBeenCalledTimes(1);
    const createArg = repository.create.mock
      .calls[0][0] as Partial<RefreshToken>;
    expect(createArg.user).toBe(user);
    expect(createArg.deviceInfo).toBe('jest-agent');
    expect(createArg.revokedAt).toBeNull();
    expect(createArg.expiresAt).toBeInstanceOf(Date);
    // token_hash phải khác plaintext, và đúng bằng sha256(plaintext)
    expect(createArg.tokenHash).not.toBe(result.refreshToken);
    expect(createArg.tokenHash).toBe(
      service.hashRefreshToken(result.refreshToken),
    );

    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it('expiresAt cách hiện tại khoảng 30 ngày', async () => {
    const before = Date.now();
    const result = await service.issueTokenPair(user, null);
    const after = Date.now();

    const createArg = repository.create.mock
      .calls[0][0] as Partial<RefreshToken>;
    const expiresAtMs = (createArg.expiresAt as Date).getTime();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    expect(expiresAtMs).toBeGreaterThanOrEqual(before + thirtyDaysMs - 1000);
    expect(expiresAtMs).toBeLessThanOrEqual(after + thirtyDaysMs + 1000);
    void result;
  });

  it('hashRefreshToken là deterministic (cùng input -> cùng hash)', () => {
    expect(service.hashRefreshToken('abc')).toBe(
      service.hashRefreshToken('abc'),
    );
    expect(service.hashRefreshToken('abc')).not.toBe(
      service.hashRefreshToken('xyz'),
    );
  });

  describe('revokeByUserAndToken', () => {
    it('thu hồi đúng token: set revokedAt và save', async () => {
      const existing: RefreshToken = {
        id: 'rt-1',
        user,
        tokenHash: service.hashRefreshToken('plain-refresh-token'),
        deviceInfo: 'jest-agent',
        expiresAt: new Date(Date.now() + 1000),
        revokedAt: null,
      };
      repository.findOne.mockResolvedValue(existing);

      await service.revokeByUserAndToken(user.id, 'plain-refresh-token');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: {
          tokenHash: service.hashRefreshToken('plain-refresh-token'),
          user: { id: user.id },
        },
      });
      expect(repository.save).toHaveBeenCalledTimes(1);
      const savedArg = repository.save.mock.calls[0][0] as RefreshToken;
      expect(savedArg.revokedAt).toBeInstanceOf(Date);
    });

    it('token đã bị thu hồi trước đó: idempotent, không gọi save lại', async () => {
      repository.findOne.mockResolvedValue({
        id: 'rt-1',
        user,
        tokenHash: 'hash',
        deviceInfo: null,
        expiresAt: new Date(Date.now() + 1000),
        revokedAt: new Date('2026-01-01T00:00:00Z'),
      });

      await expect(
        service.revokeByUserAndToken(user.id, 'already-revoked-token'),
      ).resolves.toBeUndefined();
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('token không tồn tại/không thuộc user: idempotent, không throw, không gọi save', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.revokeByUserAndToken(user.id, 'unknown-token'),
      ).resolves.toBeUndefined();
      expect(repository.save).not.toHaveBeenCalled();
    });
  });
});
