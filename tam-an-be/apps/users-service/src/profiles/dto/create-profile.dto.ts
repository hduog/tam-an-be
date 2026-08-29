import {
  IsEnum,
  IsISO8601,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole } from '@shared-auth';

/**
 * Payload nội bộ từ auth-service (POST /internal/users) — không phải
 * request từ client thật, nhưng vẫn giữ đúng convention snake_case của
 * mọi DTO khác trong repo.
 */
export class CreateProfileDto {
  @IsUUID()
  user_id: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsISO8601()
  identity_created_at: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  display_name: string;
}
