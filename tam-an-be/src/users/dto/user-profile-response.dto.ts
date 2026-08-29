import { User } from '../user.entity';

// Hồ sơ đầy đủ của chính chủ tài khoản (self-view) — khác với
// PublicUserProfileDto (public-facing, ẩn email/status), dùng cho các
// endpoint Owner (PATCH/DELETE /users/me).
export interface UserProfileResponseDto {
  id: string;
  email: string;
  role: string;
  display_name: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  email_verified_at: Date | null;
  status: string;
}

export function toUserProfileResponse(user: User): UserProfileResponseDto {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    display_name: user.displayName,
    username: user.username,
    avatar_url: user.avatarUrl,
    bio: user.bio,
    email_verified_at: user.emailVerifiedAt,
    status: user.status,
  };
}
