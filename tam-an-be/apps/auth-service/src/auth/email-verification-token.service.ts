import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

const EMAIL_VERIFICATION_PURPOSE = 'email_verification';
const EMAIL_VERIFICATION_EXPIRES_IN = '24h';

interface EmailVerificationPayload extends jwt.JwtPayload {
  sub: string;
  purpose: typeof EMAIL_VERIFICATION_PURPOSE;
}

/**
 * Token xác thực email: JWT ngắn hạn (24h), ký bằng cùng JWT_ACCESS_SECRET
 * nhưng có claim `purpose` riêng để KHÔNG thể dùng lẫn với access token
 * (hoặc ngược lại) dù cùng secret. Không cần bảng token riêng trong DB —
 * việc "đã dùng" được xác định qua field `email_verified_at` trên chính
 * user (xem AuthService.verifyEmail), đơn giản hơn mà vẫn đủ AC.
 */
@Injectable()
export class EmailVerificationTokenService {
  constructor(private readonly configService: ConfigService) {}

  sign(userId: string): string {
    const secret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    return jwt.sign(
      { sub: userId, purpose: EMAIL_VERIFICATION_PURPOSE },
      secret,
      {
        expiresIn: EMAIL_VERIFICATION_EXPIRES_IN,
      },
    );
  }

  verifyAndGetUserId(token: string): string {
    const secret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    let payload: EmailVerificationPayload;
    try {
      payload = jwt.verify(token, secret) as EmailVerificationPayload;
    } catch {
      throw new UnauthorizedException(
        'Token xác thực email không hợp lệ hoặc đã hết hạn',
      );
    }

    if (payload.purpose !== EMAIL_VERIFICATION_PURPOSE || !payload.sub) {
      throw new UnauthorizedException('Token xác thực email không hợp lệ');
    }

    return payload.sub;
  }
}
