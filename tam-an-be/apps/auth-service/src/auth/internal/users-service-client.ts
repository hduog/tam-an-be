import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@shared-auth';

const REQUEST_TIMEOUT_MS = 5_000;

export interface CreateProfilePayload {
  userId: string;
  role: UserRole;
  identityCreatedAt: Date;
  displayName: string;
}

/**
 * Gọi HTTP nội bộ sang users-service — chỉ auth-service (giữ private
 * key) mới có quyền gọi các route /internal/users, xác thực bằng
 * INTERNAL_API_KEY (xem InternalApiKeyGuard trong libs/shared-common).
 */
@Injectable()
export class UsersServiceClient {
  private readonly logger = new Logger(UsersServiceClient.name);

  constructor(private readonly configService: ConfigService) {}

  /** Ném lỗi khi tạo thất bại (non-2xx/timeout/lỗi mạng) — để AuthService bắt và compensate. */
  async createProfile(payload: CreateProfilePayload): Promise<void> {
    const response = await fetch(`${this.baseUrl()}/internal/users`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        user_id: payload.userId,
        role: payload.role,
        identity_created_at: payload.identityCreatedAt.toISOString(),
        display_name: payload.displayName,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(
        `users-service trả lỗi khi tạo profile: ${response.status}`,
      );
    }
  }

  /** Best-effort — không bao giờ throw, chỉ log cảnh báo khi thất bại. */
  async deleteProfile(userId: string): Promise<void> {
    try {
      const response = await fetch(
        `${this.baseUrl()}/internal/users/${userId}`,
        {
          method: 'DELETE',
          headers: this.headers(),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        },
      );
      if (!response.ok) {
        this.logger.warn(
          `Xoá profile (userId=${userId}) trên users-service thất bại: ${response.status}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Không gọi được users-service để xoá profile (userId=${userId}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private baseUrl(): string {
    return this.configService.getOrThrow<string>('USERS_SERVICE_URL');
  }

  private headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Internal-Api-Key':
        this.configService.getOrThrow<string>('INTERNAL_API_KEY'),
    };
  }
}
