import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { UserStatus } from '@shared-auth';
import { UserProfile } from './user-profile.entity';
import { PublicUserProfileDto } from './dto/public-user-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  toUserProfileResponse,
  UserProfileResponseDto,
} from './dto/user-profile-response.dto';

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(UserProfile)
    private readonly profilesRepository: Repository<UserProfile>,
  ) {}

  findByUserId(userId: string): Promise<UserProfile | null> {
    return this.profilesRepository.findOne({ where: { userId } });
  }

  async getPublicProfileByUsername(
    username: string,
  ): Promise<PublicUserProfileDto> {
    const profile = await this.profilesRepository.findOne({
      where: { username },
    });

    // Suspended/deleted accounts hidden the same way as missing ones
    // (confirmed by PO — see issue #11). `status` is denormalized từ
    // auth-service, đồng bộ qua internal API khi identity thay đổi.
    if (
      !profile ||
      profile.status === UserStatus.SUSPENDED ||
      profile.status === UserStatus.DELETED
    ) {
      throw new NotFoundException('User not found');
    }

    return {
      username: profile.username as string,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      bio: profile.bio,
      role: profile.role,
      createdAt: profile.identityCreatedAt,
    };
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserProfileResponseDto> {
    const profile = await this.findByUserId(userId);
    // Route cố định /users/me — Owner luôn là chính user trong token, nên
    // không cần so sánh id; chỉ còn case token hợp lệ nhưng account đã bị
    // xoá/suspend sau khi phát hành.
    if (!profile || profile.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Phiên đăng nhập không còn hiệu lực');
    }

    if (dto.username && dto.username !== profile.username) {
      const existing = await this.profilesRepository.findOne({
        where: { username: dto.username, userId: Not(userId) },
      });
      if (existing) {
        throw new ConflictException('username đã được sử dụng');
      }
      profile.username = dto.username;
    }

    if (dto.display_name !== undefined) {
      profile.displayName = dto.display_name;
    }
    if (dto.bio !== undefined) {
      profile.bio = dto.bio;
    }
    if (dto.avatar_url !== undefined) {
      profile.avatarUrl = dto.avatar_url;
    }

    const saved = await this.profilesRepository.save(profile);
    return toUserProfileResponse(saved);
  }
}
