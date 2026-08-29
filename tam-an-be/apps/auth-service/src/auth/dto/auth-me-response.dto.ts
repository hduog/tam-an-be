import { User } from '../../identity/user.entity';

export interface AuthMeResponseDto {
  id: string;
  email: string;
  role: string;
  status: string;
  provider: string;
  email_verified_at: Date | null;
  created_at: Date;
}

export function toAuthMeResponse(user: User): AuthMeResponseDto {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    provider: user.provider,
    email_verified_at: user.emailVerifiedAt,
    created_at: user.createdAt,
  };
}
