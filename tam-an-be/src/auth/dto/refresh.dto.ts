import { IsString, MinLength } from 'class-validator';

export class RefreshDto {
  @IsString()
  @MinLength(1, { message: 'refresh_token không được để trống' })
  refresh_token: string;
}
