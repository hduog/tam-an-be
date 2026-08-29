import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';
import {
  SocialTokenVerifier,
  VerifiedSocialToken,
} from '../interfaces/social-token-verifier.interface';

const APPLE_ISSUER = 'https://appleid.apple.com';
const APPLE_JWKS_URI = 'https://appleid.apple.com/auth/keys';

interface AppleIdTokenPayload extends jwt.JwtPayload {
  sub: string;
  email?: string;
}

@Injectable()
export class AppleTokenVerifierService implements SocialTokenVerifier {
  // Không đánh dấu `private` — `getSigningKey` được jwks-rsa gán như một
  // property riêng của instance (không phải prototype method), nên test
  // cần mock trực tiếp qua instance này thay vì qua JwksClient.prototype.
  readonly jwks = new JwksClient({ jwksUri: APPLE_JWKS_URI });

  constructor(private readonly configService: ConfigService) {}

  async verify(idToken: string): Promise<VerifiedSocialToken> {
    const audience = this.configService.get<string>('APPLE_CLIENT_ID');
    if (!audience) {
      throw new UnauthorizedException(
        'Đăng nhập Apple chưa được cấu hình trên server',
      );
    }

    const decoded = jwt.decode(idToken, { complete: true });
    const kid = decoded?.header.kid;
    if (!kid) {
      throw new UnauthorizedException('Apple idToken không hợp lệ');
    }

    let signingKey: string;
    try {
      const key = await this.jwks.getSigningKey(kid);
      signingKey = key.getPublicKey();
    } catch {
      throw new UnauthorizedException('Không xác thực được Apple idToken');
    }

    let payload: AppleIdTokenPayload;
    try {
      payload = jwt.verify(idToken, signingKey, {
        algorithms: ['RS256'],
        issuer: APPLE_ISSUER,
        audience,
      }) as AppleIdTokenPayload;
    } catch {
      throw new UnauthorizedException(
        'Apple idToken không hợp lệ hoặc đã hết hạn',
      );
    }

    if (!payload.sub) {
      throw new UnauthorizedException('Apple idToken thiếu thông tin bắt buộc');
    }

    // Apple chỉ trả email trong idToken ở lần cấp quyền đầu tiên (hoặc
    // private relay email nếu user chọn ẩn) — không có sẵn cơ chế lấy lại
    // sau đó. Từ chối rõ ràng thay vì tạo user với email rỗng/giả.
    if (!payload.email) {
      throw new UnauthorizedException(
        'Apple idToken không có email — cần cấp quyền lại từ đầu (Apple chỉ trả email lần đăng nhập đầu tiên)',
      );
    }

    return { providerId: payload.sub, email: payload.email };
  }
}
