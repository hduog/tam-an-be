import {
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'display_name phải có ít nhất 2 ký tự' })
  @MaxLength(120)
  display_name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'bio tối đa 500 ký tự' })
  bio?: string;

  // Quy chuẩn cho URL /@username: chỉ chữ thường, số, dấu gạch dưới,
  // không dấu, không khoảng trắng, 3-30 ký tự.
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9_]{3,30}$/, {
    message: 'username chỉ gồm chữ thường, số, dấu gạch dưới, dài 3-30 ký tự',
  })
  username?: string;

  // Nhận URL ảnh đã upload sẵn (client tự upload qua kênh khác) — flow
  // upload file trực tiếp (multipart -> cloud storage) cần S3/R2 đã cấu
  // hình ở S0, hiện chưa có trong codebase (xem ghi chú trong PR).
  @IsOptional()
  @IsUrl({}, { message: 'avatar_url phải là URL hợp lệ' })
  avatar_url?: string;
}
