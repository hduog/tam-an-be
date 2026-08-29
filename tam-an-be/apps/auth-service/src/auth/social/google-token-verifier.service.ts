import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import {
  SocialTokenVerifier,
  VerifiedSocialToken,
} from '../interfaces/social-token-verifier.interface';

@Injectable()
export class GoogleTokenVerifierService implements SocialTokenVerifier {
  private readonly client: OAuth2Client;

  constructor(private readonly configService: ConfigService) {
    // Không getOrThrow — thiếu client id chỉ nên chặn riêng luồng social
    // login (báo lỗi rõ ràng khi verify), không chặn khởi động cả app.
    this.client = new OAuth2Client(
      this.configService.get<string>('GOOGLE_CLIENT_ID'),
    );
  }

  async verify(idToken: string): Promise<VerifiedSocialToken> {
    const audience = this.configService.get<string>('GOOGLE_CLIENT_ID');
    if (!audience) {
      throw new UnauthorizedException(
        'Đăng nhập Google chưa được cấu hình trên server',
      );
    }

    let payload: import('google-auth-library').TokenPayload | undefined;
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException(
        'Google idToken không hợp lệ hoặc đã hết hạn',
      );
    }

    if (!payload?.sub || !payload.email) {
      throw new UnauthorizedException(
        'Google idToken thiếu thông tin bắt buộc',
      );
    }

    return {
      providerId: payload.sub,
      email: payload.email,
      displayName: payload.name,
    };
  }
}
