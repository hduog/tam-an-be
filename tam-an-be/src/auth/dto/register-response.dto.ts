import { User } from '../../users/user.entity';

export interface RegisterResponseDto {
  id: string;
  email: string;
  display_name: string;
  role: string;
  status: string;
  provider: string;
  email_verified_at: Date | null;
  created_at: Date;
}

export function toRegisterResponse(user: User): RegisterResponseDto {
  return {
    id: user.id,
    email: user.email,
    display_name: user.displayName,
    role: user.role,
    status: user.status,
    provider: user.provider,
    email_verified_at: user.emailVerifiedAt,
    created_at: user.createdAt,
  };
}
