import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8, { message: 'password phải có ít nhất 8 ký tự' })
  @MaxLength(128)
  @Matches(/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'password phải có ít nhất 1 chữ hoa, 1 chữ thường và 1 chữ số',
  })
  password: string;

  @IsString()
  @MinLength(2, { message: 'display_name phải có ít nhất 2 ký tự' })
  @MaxLength(120)
  display_name: string;
}
