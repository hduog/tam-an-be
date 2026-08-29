import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InternalApiKeyGuard } from '@shared-common';
import { ProfilesService } from './profiles.service';
import { CreateProfileDto } from './dto/create-profile.dto';

/**
 * Service-to-service — chỉ auth-service gọi, xác thực bằng
 * INTERNAL_API_KEY (InternalApiKeyGuard), KHÔNG phải JwtAuthGuard vì
 * không có JWT user nào ở đây.
 */
@Controller('internal/users')
@UseGuards(InternalApiKeyGuard)
export class InternalUsersController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateProfileDto): Promise<{ message: string }> {
    await this.profilesService.createFromIdentity({
      userId: dto.user_id,
      role: dto.role,
      identityCreatedAt: new Date(dto.identity_created_at),
      displayName: dto.display_name,
    });
    return { message: 'Tạo hồ sơ thành công' };
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.OK)
  async delete(
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<{ message: string }> {
    await this.profilesService.deleteByUserId(userId);
    return { message: 'Đã xoá hồ sơ' };
  }
}
