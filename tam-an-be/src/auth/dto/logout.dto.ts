import { IsString, MinLength } from 'class-validator';

export class LogoutDto {
  @IsString()
  @MinLength(1, { message: 'refresh_token không được để trống' })
  refresh_token: string;
}
