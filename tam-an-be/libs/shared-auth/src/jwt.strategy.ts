import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import {
  ExtractJwt,
  Strategy,
  StrategyOptionsWithoutRequest,
} from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import {
  AuthenticatedUser,
  JwtPayload,
} from './interfaces/jwt-payload.interface';
import { derivePublicKeyPem } from './rsa-keys.util';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    super(JwtStrategy.buildStrategyOptions(configService));
  }

  /**
   * 2 chế độ verify RS256, chọn theo biến env nào có mặt:
   * - `JWT_PRIVATE_KEY` (chỉ auth-service có): verify bằng public key suy
   *   ra ngay trong process — không tự gọi HTTP tới JWKS của chính mình.
   * - `AUTH_JWKS_URI` (các service khác, ví dụ users-service): verify qua
   *   JWKS thật của auth-service (`jwks-rsa`), không giữ key nào cả.
   * Mỗi service tự khai báo `forbidden()` cho biến của phía kia trong
   * `env.validation.ts` để tránh âm thầm chọn nhầm chế độ khi copy nhầm .env.
   */
  private static buildStrategyOptions(
    configService: ConfigService,
  ): StrategyOptionsWithoutRequest {
    const jwtFromRequest = ExtractJwt.fromAuthHeaderAsBearerToken();
    const privateKey = configService.get<string>('JWT_PRIVATE_KEY');
    if (privateKey) {
      return {
        jwtFromRequest,
        ignoreExpiration: false,
        algorithms: ['RS256'],
        secretOrKey: derivePublicKeyPem(privateKey),
      };
    }

    const jwksUri = configService.get<string>('AUTH_JWKS_URI');
    if (jwksUri) {
      return {
        jwtFromRequest,
        ignoreExpiration: false,
        algorithms: ['RS256'],
        secretOrKeyProvider: passportJwtSecret({
          jwksUri,
          cache: true,
          rateLimit: true,
          jwksRequestsPerMinute: 5,
        }),
      };
    }

    throw new Error(
      'JwtStrategy: cần cấu hình JWT_PRIVATE_KEY (auth-service) hoặc AUTH_JWKS_URI (service khác)',
    );
  }

  // Called by Passport only after the token signature & expiry already
  // checked out; anything thrown here still surfaces as 401 via the guard.
  validate(payload: JwtPayload): AuthenticatedUser {
    if (!payload?.sub || !payload?.role) {
      throw new UnauthorizedException('Invalid token payload');
    }
    return { id: payload.sub, role: payload.role };
  }
}
