import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createPublicKey } from 'crypto';
import * as jwt from 'jsonwebtoken';
import { IsNull, Repository } from 'typeorm';
import { UserRole, UserStatus } from '@shared-auth';
import { generateTestRsaKeyPair } from '@shared-auth/testing/rsa-test-keypair';
import { RefreshToken } from './refresh-token.entity';
import { AuthProvider, User } from '../identity/user.entity';
import { TokenService } from './token.service';

const { privateKeyPem: TEST_PRIVATE_KEY } = generateTestRsaKeyPair();

describe('TokenService', () => {
  let service: TokenService;
  let jwtService: jest.Mocked<Pick<JwtService, 'sign'>>;
  let configService: jest.Mocked<Pick<ConfigService, 'get' | 'getOrThrow'>>;
  let repository: jest.Mocked<
    Pick<Repository<RefreshToken>, 'create' | 'save' | 'findOne' | 'find'>
  >;

  const user: User = Object.assign(new User(), {
    id: 'user-id-1',
    email: 'user@tam-an.dev',
    passwordHash: 'hash',
    role: UserRole.USER,
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
    configService = {
      get: jest.fn().mockReturnValue('test-key-1'),
      getOrThrow: jest.fn().mockReturnValue(TEST_PRIVATE_KEY),
    };
    repository = {
      create: jest.fn((data) => data as RefreshToken),
      save: jest.fn((entity) => Promise.resolve(entity as RefreshToken)),
      findOne: jest.fn(),
      find: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
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

  describe('rotateRefreshToken', () => {
    const buildEntity = (
      overrides: Partial<RefreshToken> = {},
    ): RefreshToken => ({
      id: 'rt-1',
      user,
      tokenHash: service.hashRefreshToken('valid-refresh-token'),
      deviceInfo: 'old-device',
      expiresAt: new Date(Date.now() + 1000),
      revokedAt: null,
      ...overrides,
    });

    it('refresh hợp lệ: thu hồi token cũ, cấp cặp token mới cho đúng user', async () => {
      repository.findOne.mockResolvedValue(buildEntity());

      const result = await service.rotateRefreshToken(
        'valid-refresh-token',
        'new-device',
      );

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { tokenHash: service.hashRefreshToken('valid-refresh-token') },
        relations: ['user'],
      });
      // Save 2 lần: 1 lần revoke token cũ (trong rotateRefreshToken), 1 lần
      // tạo token mới (bên trong issueTokenPair).
      expect(repository.save).toHaveBeenCalledTimes(2);
      const revokedOld = repository.save.mock.calls[0][0] as RefreshToken;
      expect(revokedOld.revokedAt).toBeInstanceOf(Date);

      expect(result.accessToken).toBe('signed-access-token');
      expect(result.refreshToken).toEqual(expect.any(String));
      expect(result.refreshToken).not.toBe('valid-refresh-token');
    });

    it('refresh token không tồn tại: ném 401, không cấp token', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.rotateRefreshToken('unknown-token', null),
      ).rejects.toThrow(UnauthorizedException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('refresh token đã hết hạn: ném 401, không cấp token', async () => {
      repository.findOne.mockResolvedValue(
        buildEntity({ expiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(
        service.rotateRefreshToken('expired-token', null),
      ).rejects.toThrow(UnauthorizedException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('reuse detection: token đã bị thu hồi trước đó -> ném 401 và thu hồi TOÀN BỘ refresh token còn active của user', async () => {
      repository.findOne.mockResolvedValue(
        buildEntity({ revokedAt: new Date('2026-01-01T00:00:00Z') }),
      );
      const otherActiveTokens: RefreshToken[] = [
        buildEntity({ id: 'rt-2', revokedAt: null }),
        buildEntity({ id: 'rt-3', revokedAt: null }),
      ];
      repository.find.mockResolvedValue(otherActiveTokens);

      await expect(
        service.rotateRefreshToken('stolen-and-reused-token', null),
      ).rejects.toThrow(UnauthorizedException);

      expect(repository.find).toHaveBeenCalledWith({
        where: { user: { id: user.id }, revokedAt: IsNull() },
      });
      expect(repository.save).toHaveBeenCalledTimes(2);
      for (const call of repository.save.mock.calls) {
        expect((call[0] as RefreshToken).revokedAt).toBeInstanceOf(Date);
      }
    });
  });

  describe('getJwks', () => {
    it('trả đúng shape JWKS với kid từ JWT_KEY_ID', () => {
      const result = service.getJwks();

      expect(result.keys).toHaveLength(1);
      expect(result.keys[0]).toMatchObject({
        kty: 'RSA',
        kid: 'test-key-1',
        use: 'sig',
        alg: 'RS256',
      });
      expect(configService.getOrThrow).toHaveBeenCalledWith('JWT_PRIVATE_KEY');
    });

    it('public key trong JWKS verify được token ký bởi private key tương ứng', () => {
      const result = service.getJwks();
      const jwk = result.keys[0];

      const token = jwt.sign({ sub: 'user-1' }, TEST_PRIVATE_KEY, {
        algorithm: 'RS256',
        keyid: jwk.kid,
      });
      const publicKeyPem = createPublicKey({
        key: { kty: jwk.kty, n: jwk.n, e: jwk.e },
        format: 'jwk',
      })
        .export({ type: 'spki', format: 'pem' })
        .toString();

      expect(() =>
        jwt.verify(token, publicKeyPem, { algorithms: ['RS256'] }),
      ).not.toThrow();
    });
  });
});
