import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { IsNull, Repository } from 'typeorm';
import { RefreshToken } from '../users/refresh-token.entity';
import { User } from '../users/user.entity';

const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 ngày

// Message chung cho mọi lý do refresh thất bại (không tìm thấy, hết hạn,
// đã bị thu hồi/reuse) — không tiết lộ lý do cụ thể, chỉ báo cần đăng
// nhập lại.
const REFRESH_INVALID_MESSAGE =
  'Refresh token không hợp lệ hoặc đã hết hạn, vui lòng đăng nhập lại';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Phát hành cặp access/refresh token — dùng chung cho mọi flow tạo phiên
 * đăng nhập (login #03, social #04, và auto-login khi register #02),
 * để tránh mỗi flow tự viết lại logic sinh/lưu refresh token.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(RefreshToken)
    private readonly refreshTokensRepository: Repository<RefreshToken>,
  ) {}

  async issueTokenPair(
    user: User,
    deviceInfo: string | null,
  ): Promise<TokenPair> {
    const accessToken = this.jwtService.sign({
      sub: user.id,
      role: user.role,
    });

    const refreshToken = randomBytes(64).toString('hex');
    const entity = this.refreshTokensRepository.create({
      user,
      tokenHash: this.hashRefreshToken(refreshToken),
      deviceInfo,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      revokedAt: null,
    });
    await this.refreshTokensRepository.save(entity);

    return { accessToken, refreshToken };
  }

  /**
   * SHA-256, không phải Argon2: refresh token đã là random 512-bit (không
   * đoán được), không cần salt + slow hash như password. Cần deterministic
   * để tra cứu theo hash khi verify (Issue #05), Argon2 không cho phép điều
   * đó (salt ngẫu nhiên mỗi lần hash).
   */
  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Thu hồi đúng refresh token của user đang gọi (không phải toàn bộ thiết
   * bị) — idempotent: không tìm thấy hoặc đã revoke trước đó đều coi là
   * thành công, không throw, không tiết lộ token có tồn tại hay không.
   */
  async revokeByUserAndToken(
    userId: string,
    refreshToken: string,
  ): Promise<void> {
    const tokenHash = this.hashRefreshToken(refreshToken);
    const entity = await this.refreshTokensRepository.findOne({
      where: { tokenHash, user: { id: userId } },
    });

    if (!entity || entity.revokedAt) {
      return;
    }

    entity.revokedAt = new Date();
    await this.refreshTokensRepository.save(entity);
  }

  /**
   * Rotate: đổi refresh token cũ lấy cặp token mới, thu hồi token cũ ngay
   * khi thành công. Nếu token đưa lên đã bị revoke từ trước (đã rotate
   * hoặc đã logout) mà vẫn được dùng lại — dấu hiệu bị đánh cắp (reuse
   * detection) — thu hồi TOÀN BỘ refresh token của user để buộc đăng
   * nhập lại trên mọi thiết bị, chặn kẻ tấn công tiếp tục dùng token cũ.
   */
  async rotateRefreshToken(
    refreshToken: string,
    deviceInfo: string | null,
  ): Promise<TokenPair> {
    const tokenHash = this.hashRefreshToken(refreshToken);
    const entity = await this.refreshTokensRepository.findOne({
      where: { tokenHash },
      relations: ['user'],
    });

    if (!entity) {
      throw new UnauthorizedException(REFRESH_INVALID_MESSAGE);
    }

    if (entity.revokedAt) {
      await this.revokeAllForUser(entity.user.id);
      throw new UnauthorizedException(REFRESH_INVALID_MESSAGE);
    }

    if (entity.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException(REFRESH_INVALID_MESSAGE);
    }

    entity.revokedAt = new Date();
    await this.refreshTokensRepository.save(entity);

    return this.issueTokenPair(entity.user, deviceInfo);
  }

  private async revokeAllForUser(userId: string): Promise<void> {
    const activeTokens = await this.refreshTokensRepository.find({
      where: { user: { id: userId }, revokedAt: IsNull() },
    });
    const now = new Date();
    await Promise.all(
      activeTokens.map((token) => {
        token.revokedAt = now;
        return this.refreshTokensRepository.save(token);
      }),
    );
  }
}
