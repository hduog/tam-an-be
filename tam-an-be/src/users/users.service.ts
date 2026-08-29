import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { User, UserStatus } from './user.entity';
import { PublicUserProfileDto } from './dto/public-user-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import {
  toUserProfileResponse,
  UserProfileResponseDto,
} from './dto/user-profile-response.dto';

export interface CreateUserData {
  email: string;
  passwordHash: string | null;
  displayName: string;
  role: User['role'];
  status: User['status'];
  provider: User['provider'];
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });
  }

  create(data: CreateUserData): Promise<User> {
    const user = this.usersRepository.create(data);
    return this.usersRepository.save(user);
  }

  async getPublicProfileByUsername(
    username: string,
  ): Promise<PublicUserProfileDto> {
    const user = await this.usersRepository.findOne({
      where: { username, deletedAt: IsNull() },
    });

    // Suspended accounts are hidden the same way as missing/deleted ones
    // (confirmed by PO — see issue #11).
    if (!user || user.status === UserStatus.SUSPENDED) {
      throw new NotFoundException('User not found');
    }

    return {
      username: user.username as string,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<UserProfileResponseDto> {
    const user = await this.findById(userId);
    // Route cố định /users/me — Owner luôn là chính user trong token, nên
    // không cần so sánh id; chỉ còn case token hợp lệ nhưng account đã bị
    // xoá/suspend sau khi phát hành (nhất quán với AuthService.me).
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Phiên đăng nhập không còn hiệu lực');
    }

    if (dto.username && dto.username !== user.username) {
      const existing = await this.usersRepository.findOne({
        where: { username: dto.username, id: Not(userId) },
      });
      if (existing) {
        throw new ConflictException('username đã được sử dụng');
      }
      user.username = dto.username;
    }

    if (dto.display_name !== undefined) {
      user.displayName = dto.display_name;
    }
    if (dto.bio !== undefined) {
      user.bio = dto.bio;
    }
    if (dto.avatar_url !== undefined) {
      user.avatarUrl = dto.avatar_url;
    }

    const saved = await this.usersRepository.save(user);
    return toUserProfileResponse(saved);
  }
}
