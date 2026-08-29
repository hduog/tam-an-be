jest.mock('jwks-rsa', () => {
  const actual = jest.requireActual<Record<string, unknown>>('jwks-rsa');
  return { ...actual, passportJwtSecret: jest.fn() };
});

import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from './enums/user-role.enum';
import { JwtStrategy } from './jwt.strategy';
import { generateTestRsaKeyPair } from './testing/rsa-test-keypair';

const { privateKeyPem } = generateTestRsaKeyPair();

describe('JwtStrategy', () => {
  describe('validate()', () => {
    const config = new ConfigService({ JWT_PRIVATE_KEY: privateKeyPem });
    const strategy = new JwtStrategy(config);

    it('trả về { id, role } khi payload hợp lệ', () => {
      const result = strategy.validate({
        sub: 'user-id-1',
        role: UserRole.USER,
      });

      expect(result).toEqual({ id: 'user-id-1', role: UserRole.USER });
    });

    it('ném UnauthorizedException khi payload thiếu sub', () => {
      expect(() => strategy.validate({ sub: '', role: UserRole.USER })).toThrow(
        UnauthorizedException,
      );
    });

    it('ném UnauthorizedException khi payload thiếu role', () => {
      expect(() => strategy.validate({ sub: 'user-id-1' } as never)).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('chế độ local (JWT_PRIVATE_KEY có mặt — dùng bởi auth-service)', () => {
    it('khởi tạo thành công, suy public key từ private key mà không throw', () => {
      const config = new ConfigService({ JWT_PRIVATE_KEY: privateKeyPem });
      expect(() => new JwtStrategy(config)).not.toThrow();
    });
  });

  describe('chế độ JWKS-remote (AUTH_JWKS_URI có mặt — dùng bởi users-service...)', () => {
    it('gọi jwks-rsa.passportJwtSecret đúng tham số, không gọi mạng thật', () => {
      const sentinelProvider = jest.fn();
      const { passportJwtSecret } = jest.requireMock<{
        passportJwtSecret: jest.Mock;
      }>('jwks-rsa');
      passportJwtSecret.mockReturnValue(sentinelProvider);

      const config = new ConfigService({
        AUTH_JWKS_URI: 'http://auth-service.local/auth/jwks.json',
      });
      const strategy = new JwtStrategy(config);

      expect(passportJwtSecret).toHaveBeenCalledWith({
        jwksUri: 'http://auth-service.local/auth/jwks.json',
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
      });
      // `secretOrKeyProvider` được passport-jwt gán làm own-instance
      // property `_secretOrKeyProvider` trong constructor (không phải
      // prototype method) — cùng kiểu vấn đề đã gặp với JwksClient trong
      // apple-token-verifier.service.ts.
      expect(
        (strategy as unknown as { _secretOrKeyProvider: unknown })
          ._secretOrKeyProvider,
      ).toBe(sentinelProvider);
    });
  });

  describe('thiếu cấu hình', () => {
    it('ném lỗi rõ ràng khi thiếu cả JWT_PRIVATE_KEY lẫn AUTH_JWKS_URI', () => {
      const config = new ConfigService({});
      expect(() => new JwtStrategy(config)).toThrow(
        /JWT_PRIVATE_KEY.*AUTH_JWKS_URI/,
      );
    });
  });
});
