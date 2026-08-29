import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SharedAuthModule } from '@shared-auth';
import { UserProfile } from './user-profile.entity';
import { ProfilesService } from './profiles.service';
import { ProfilesController } from './profiles.controller';
import { InternalUsersController } from './internal-users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserProfile]), SharedAuthModule],
  controllers: [ProfilesController, InternalUsersController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
