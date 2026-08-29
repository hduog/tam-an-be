import { UserProfile } from '../user-profile.entity';

// Hồ sơ đầy đủ của chính chủ tài khoản (self-view, Owner) — khác với
// PublicUserProfileDto (public-facing). Không có email/email_verified_at
// — đó là field định danh, thuộc auth-service (GET /auth/me).
export interface UserProfileResponseDto {
  user_id: string;
  username: string | null;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  role: string;
  status: string;
}

export function toUserProfileResponse(
  profile: UserProfile,
): UserProfileResponseDto {
  return {
    user_id: profile.userId,
    username: profile.username,
    display_name: profile.displayName,
    avatar_url: profile.avatarUrl,
    bio: profile.bio,
    role: profile.role,
    status: profile.status,
  };
}
