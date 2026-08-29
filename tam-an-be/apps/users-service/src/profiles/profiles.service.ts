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

export interface CreateProfileData {
  userId: string;
  role: UserProfile['role'];
  identityCreatedAt: Date;
  displayName: string;
}

@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(UserProfile)
    private readonly profilesRepository: Repository<UserProfile>,
  ) {}

  findByUserId(userId: string): Promise<UserProfile | null> {
    return this.profilesRepository.findOne({ where: { userId } });
  }

  /**
   * Idempotent-safe cho retry từ auth-service: dùng ON CONFLICT DO NOTHING
   * trên PK (userId) thay vì check-rồi-insert, tránh race khi 2 retry gần
   * như đồng thời cùng insert.
   */
  async createFromIdentity(data: CreateProfileData): Promise<UserProfile> {
    await this.profilesRepository
      .createQueryBuilder()
      .insert()
      .into(UserProfile)
      .values({
        userId: data.userId,
        role: data.role,
        identityCreatedAt: data.identityCreatedAt,
        displayName: data.displayName,
      })
      .orIgnore()
      .execute();

    return (await this.findByUserId(data.userId)) as UserProfile;
  }

  /** Idempotent — xoá 0 dòng (profile không tồn tại) không throw. */
  async deleteByUserId(userId: string): Promise<void> {
    await this.profilesRepository.delete({ userId });
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
