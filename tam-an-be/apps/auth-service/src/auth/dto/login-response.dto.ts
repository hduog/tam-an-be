import { User } from '../../identity/user.entity';

export interface LoginResponseDto {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
    role: string;
    status: string;
  };
}

export function toLoginResponse(
  user: User,
  accessToken: string,
  refreshToken: string,
): LoginResponseDto {
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    },
  };
}
