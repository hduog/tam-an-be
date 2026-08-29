import { ConflictException, Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthProvider, UserRole, UserStatus } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import {
  RegisterResponseDto,
  toRegisterResponse,
} from './dto/register-response.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly usersService: UsersService) {}

  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email đã được sử dụng');
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      displayName: dto.display_name,
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      provider: AuthProvider.LOCAL,
    });

    // Issue #07 chưa triển khai luồng gửi email xác thực thật (không có
    // MailerService/token table trong codebase). Log lại để không âm thầm
    // bỏ qua acceptance criteria; thay thế bằng luồng thật khi #07 hoàn thành.
    this.logger.log(
      `TODO(#7): gửi email xác thực cho user ${user.id} (${user.email})`,
    );

    return toRegisterResponse(user);
  }
}
