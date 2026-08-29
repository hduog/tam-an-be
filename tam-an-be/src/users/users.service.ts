import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { User, UserStatus } from './user.entity';
import { PublicUserProfileDto } from './dto/public-user-profile.dto';

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
}
