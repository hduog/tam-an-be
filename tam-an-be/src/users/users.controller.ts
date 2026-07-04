import { Controller, Get, Param } from '@nestjs/common';
import { UsersService } from './users.service';
import { PublicUserProfileDto } from './dto/public-user-profile.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':username')
  getPublicProfile(
    @Param('username') username: string,
  ): Promise<PublicUserProfileDto> {
    return this.usersService.getPublicProfileByUsername(username);
  }
}
