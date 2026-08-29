import { User } from '../../users/user.entity';

export interface LoginResponseDto {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
    display_name: string;
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
      display_name: user.displayName,
      role: user.role,
      status: user.status,
    },
  };
}
