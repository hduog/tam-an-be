import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FindOperator, Repository } from 'typeorm';
import { UsersService } from './users.service';
import { AuthProvider, User, UserRole, UserStatus } from './user.entity';

interface MockRepository {
  findOne: jest.MockedFunction<Repository<User>['findOne']>;
}

const createMockRepository = (): MockRepository => ({
  findOne: jest.fn(),
});

describe('UsersService', () => {
  let service: UsersService;
  let repository: MockRepository;

  const buildUser = (overrides: Partial<User> = {}): User => {
    const user = new User();
    Object.assign(user, {
      id: 'a3c9a6d0-1111-4b11-9c11-000000000001',
      email: 'user@tam-an.dev',
      passwordHash: 'hashed-secret',
      role: UserRole.USER,
      displayName: 'Người dùng Demo',
      username: 'demo_user',
      avatarUrl: 'https://cdn.tam-an.dev/avatars/demo.png',
      bio: 'Xin chào, mình là demo user.',
      provider: AuthProvider.LOCAL,
      providerId: null,
      emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
      status: UserStatus.ACTIVE,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      deletedAt: null,
      ...overrides,
    });
    return user;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: createMockRepository(),
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get<MockRepository>(getRepositoryToken(User));
  });

  it('returns the public profile when the username exists and is active', async () => {
    const user = buildUser();
    repository.findOne.mockResolvedValue(user);

    const result = await service.getPublicProfileByUsername('demo_user');

    const [[findOneArgs]] = repository.findOne.mock.calls;
    expect(findOneArgs.where).toMatchObject({ username: 'demo_user' });
    expect(result).toEqual({
      username: 'demo_user',
      displayName: 'Người dùng Demo',
      avatarUrl: 'https://cdn.tam-an.dev/avatars/demo.png',
      bio: 'Xin chào, mình là demo user.',
      role: UserRole.USER,
      createdAt: user.createdAt,
    });
    expect(result).not.toHaveProperty('email');
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('throws NotFoundException when the username does not exist', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(
      service.getPublicProfileByUsername('unknown_user'),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when the account has been soft-deleted', async () => {
    // The repository query filters deletedAt IS NULL, so a deleted
    // account never comes back from findOne.
    repository.findOne.mockResolvedValue(null);

    await expect(
      service.getPublicProfileByUsername('deleted_user'),
    ).rejects.toThrow(NotFoundException);

    const [[findOneArgs]] = repository.findOne.mock.calls;
    expect(findOneArgs.where).toMatchObject({ username: 'deleted_user' });
    const where = findOneArgs.where as Record<string, unknown>;
    expect(where.deletedAt).toBeInstanceOf(FindOperator);
  });

  it('throws NotFoundException when the account is suspended', async () => {
    const user = buildUser({ status: UserStatus.SUSPENDED });
    repository.findOne.mockResolvedValue(user);

    await expect(
      service.getPublicProfileByUsername('demo_user'),
    ).rejects.toThrow(NotFoundException);
  });
});
