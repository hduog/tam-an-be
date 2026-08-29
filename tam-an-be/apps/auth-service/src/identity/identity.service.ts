import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { UserStatus } from '@shared-auth';
import { AuthProvider, User } from './user.entity';

export interface CreateUserData {
  email: string;
  passwordHash: string | null;
  role: User['role'];
  status: User['status'];
  provider: User['provider'];
  providerId?: string | null;
}

@Injectable()
export class IdentityService {
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

  async markEmailVerified(userId: string): Promise<void> {
    await this.usersRepository.update(userId, {
      emailVerifiedAt: new Date(),
    });
  }

  async softDelete(userId: string): Promise<void> {
    await this.usersRepository.update(userId, {
      status: UserStatus.DELETED,
      deletedAt: new Date(),
    });
  }
}
