import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { PublicUserProfileDto } from './dto/public-user-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserProfileResponseDto } from './dto/user-profile-response.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Cập nhật hồ sơ cá nhân (Owner)',
    description:
      'Cập nhật từng phần display_name/bio/username/avatar_url của chính tài khoản đang đăng nhập.',
  })
  @ApiResponse({ status: 200, description: 'Cập nhật thành công' })
  @ApiResponse({ status: 401, description: 'Thiếu/sai access token' })
  @ApiResponse({ status: 409, description: 'username đã được sử dụng' })
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<UserProfileResponseDto> {
    return this.usersService.updateProfile(user.id, dto);
  }

  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Xoá tài khoản của chính mình (soft delete, Owner)',
    description:
      'Set status=deleted + deleted_at, thu hồi toàn bộ refresh token (đăng xuất mọi thiết bị). Không xoá cứng dữ liệu.',
  })
  @ApiResponse({ status: 200, description: 'Xoá thành công' })
  @ApiResponse({ status: 401, description: 'Thiếu/sai access token' })
  @UseGuards(JwtAuthGuard)
  @Delete('me')
  @HttpCode(HttpStatus.OK)
  deleteMe(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<{ message: string }> {
    return this.usersService.deleteOwnAccount(user.id);
  }

  @Get(':username')
  getPublicProfile(
    @Param('username') username: string,
  ): Promise<PublicUserProfileDto> {
    return this.usersService.getPublicProfileByUsername(username);
  }
}
