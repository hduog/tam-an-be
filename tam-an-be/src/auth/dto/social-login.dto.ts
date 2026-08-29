import { IsEnum, IsString, MinLength } from 'class-validator';

export enum SocialAuthProvider {
  GOOGLE = 'google',
  APPLE = 'apple',
}

export class SocialLoginDto {
  @IsEnum(SocialAuthProvider)
  provider: SocialAuthProvider;

  // Theo quy ước snake_case chung của body trong dự án (email, display_name,
  // refresh_token...) — khác với "idToken" ghi trong mô tả issue gốc.
  @IsString()
  @MinLength(1, { message: 'id_token không được để trống' })
  id_token: string;
}
