import { User } from '../../users/user.entity';

export interface AuthMeResponseDto {
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

export function toAuthMeResponse(user: User): AuthMeResponseDto {
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
