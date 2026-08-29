import { IsString, MinLength } from 'class-validator';

export class VerifyEmailDto {
  @IsString()
  @MinLength(1, { message: 'token không được để trống' })
  token: string;
}
