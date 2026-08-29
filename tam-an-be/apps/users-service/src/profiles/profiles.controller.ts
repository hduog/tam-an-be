import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, JwtAuthGuard } from '@shared-auth';
import type { AuthenticatedUser } from '@shared-auth';
import { ProfilesService } from './profiles.service';
import { PublicUserProfileDto } from './dto/public-user-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UserProfileResponseDto } from './dto/user-profile-response.dto';

@ApiTags('Users')
@Controller('users')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

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
    return this.profilesService.updateProfile(user.id, dto);
  }

  @Get(':username')
  getPublicProfile(
    @Param('username') username: string,
  ): Promise<PublicUserProfileDto> {
    return this.profilesService.getPublicProfileByUsername(username);
  }
}
