import { TokenPair } from '../token.service';

export interface RefreshResponseDto {
  access_token: string;
  refresh_token: string;
}

export function toRefreshResponse(pair: TokenPair): RefreshResponseDto {
  return {
    access_token: pair.accessToken,
    refresh_token: pair.refreshToken,
  };
}
