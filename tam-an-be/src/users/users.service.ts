import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { AuthProvider, User, UserStatus } from './user.entity';
import { RefreshToken } from './refresh-token.entity';
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
  providerId?: string | null;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    // Inject trực tiếp thay vì gọi qua AuthModule/TokenService — AuthModule
    // đã import UsersModule, import ngược lại sẽ tạo circular dependency.
    // Thu hồi token khi xoá tài khoản vốn cũng thuộc vòng đời "account",
    // hợp lý để UsersService tự quản lý.
    @InjectRepository(RefreshToken)
    private readonly refreshTokensRepository: Repository<RefreshToken>,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });
  }

  findByProviderAndProviderId(
    provider: AuthProvider,
    providerId: string,
  ): Promise<User | null> {
    return this.usersRepository.findOne({ where: { provider, providerId } });
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

  async deleteOwnAccount(userId: string): Promise<{ message: string }> {
    const user = await this.findById(userId);
    // Route cố định /users/me — Owner luôn là chính user trong token.
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Phiên đăng nhập không còn hiệu lực');
    }

    // Soft delete: giữ lại dữ liệu tương tác lịch sử (posts/comments ở
    // các sprint sau) qua deleted_at, không xoá cứng — theo ghi chú thiết
    // kế của issue.
    user.status = UserStatus.DELETED;
    user.deletedAt = new Date();
    await this.usersRepository.save(user);

    // Thu hồi toàn bộ refresh token -> đăng xuất khỏi mọi thiết bị ngay
    // lập tức, không chờ access token hết hạn tự nhiên.
    const activeTokens = await this.refreshTokensRepository.find({
      where: { user: { id: userId }, revokedAt: IsNull() },
    });
    const now = new Date();
    await Promise.all(
      activeTokens.map((token) => {
        token.revokedAt = now;
        return this.refreshTokensRepository.save(token);
      }),
    );

    return { message: 'Tài khoản đã được xoá' };
  }
}
