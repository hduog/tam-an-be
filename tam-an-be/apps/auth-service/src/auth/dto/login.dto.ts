import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  email: string;

  // Không áp complexity rule ở đây (khác RegisterDto) — chỉ chặn rỗng.
  // Login phải chấp nhận mật khẩu cũ đã tồn tại, không phải validate lại.
  @IsString()
  @MinLength(1, { message: 'password không được để trống' })
  password: string;
}
