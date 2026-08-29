import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole, UserStatus } from '@shared-auth';
import { ProfilesService } from './profiles.service';
import { UserProfile } from './user-profile.entity';

interface MockInsertQueryBuilder {
  insert: jest.Mock;
  into: jest.Mock;
  values: jest.Mock;
  orIgnore: jest.Mock;
  execute: jest.Mock;
}

interface MockRepository {
  findOne: jest.MockedFunction<Repository<UserProfile>['findOne']>;
  save: jest.MockedFunction<Repository<UserProfile>['save']>;
  delete: jest.MockedFunction<Repository<UserProfile>['delete']>;
  createQueryBuilder: jest.Mock;
  insertQueryBuilder: MockInsertQueryBuilder;
}

const createMockInsertQueryBuilder = (): MockInsertQueryBuilder => {
  const builder: Partial<MockInsertQueryBuilder> = {};
  builder.insert = jest.fn().mockReturnValue(builder);
  builder.into = jest.fn().mockReturnValue(builder);
  builder.values = jest.fn().mockReturnValue(builder);
  builder.orIgnore = jest.fn().mockReturnValue(builder);
  builder.execute = jest.fn().mockResolvedValue(undefined);
  return builder as MockInsertQueryBuilder;
};

const createMockRepository = (): MockRepository => {
  const insertQueryBuilder = createMockInsertQueryBuilder();
  return {
    findOne: jest.fn(),
    save: jest.fn((entity) => Promise.resolve(entity)) as jest.MockedFunction<
      Repository<UserProfile>['save']
    >,
    delete: jest.fn().mockResolvedValue({ affected: 1, raw: [] }),
    createQueryBuilder: jest.fn().mockReturnValue(insertQueryBuilder),
    insertQueryBuilder,
  };
};

describe('ProfilesService', () => {
  let service: ProfilesService;
  let repository: MockRepository;

  const buildProfile = (overrides: Partial<UserProfile> = {}): UserProfile => {
    const profile = new UserProfile();
    Object.assign(profile, {
      userId: 'a3c9a6d0-1111-4b11-9c11-000000000001',
      username: 'demo_user',
      displayName: 'Người dùng Demo',
      avatarUrl: 'https://cdn.tam-an.dev/avatars/demo.png',
      bio: 'Xin chào, mình là demo user.',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      identityCreatedAt: new Date('2026-01-01T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      ...overrides,
    });
    return profile;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfilesService,
        {
          provide: getRepositoryToken(UserProfile),
          useValue: createMockRepository(),
        },
      ],
    }).compile();

    service = module.get<ProfilesService>(ProfilesService);
    repository = module.get<MockRepository>(getRepositoryToken(UserProfile));
  });

  it('returns the public profile when the username exists and is active', async () => {
    const profile = buildProfile();
    repository.findOne.mockResolvedValue(profile);

    const result = await service.getPublicProfileByUsername('demo_user');

    const [[findOneArgs]] = repository.findOne.mock.calls;
    expect(findOneArgs.where).toMatchObject({ username: 'demo_user' });
    expect(result).toEqual({
      username: 'demo_user',
      displayName: 'Người dùng Demo',
      avatarUrl: 'https://cdn.tam-an.dev/avatars/demo.png',
      bio: 'Xin chào, mình là demo user.',
      role: UserRole.USER,
      createdAt: profile.identityCreatedAt,
    });
    expect(result).not.toHaveProperty('userId');
  });

  it('throws NotFoundException when the username does not exist', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(
      service.getPublicProfileByUsername('unknown_user'),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when the account is deleted', async () => {
    repository.findOne.mockResolvedValue(
      buildProfile({ status: UserStatus.DELETED }),
    );

    await expect(
      service.getPublicProfileByUsername('deleted_user'),
    ).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when the account is suspended', async () => {
    const profile = buildProfile({ status: UserStatus.SUSPENDED });
    repository.findOne.mockResolvedValue(profile);

    await expect(
      service.getPublicProfileByUsername('demo_user'),
    ).rejects.toThrow(NotFoundException);
  });

  describe('updateProfile', () => {
    it('cập nhật thành công (partial update, không đổi username): trả hồ sơ mới, không có email', async () => {
      const profile = buildProfile();
      repository.findOne.mockResolvedValueOnce(profile); // findByUserId

      const result = await service.updateProfile(profile.userId, {
        display_name: 'Tên Mới',
        bio: 'Bio mới',
      });

      expect(repository.findOne).toHaveBeenCalledTimes(1); // không check username vì không đổi
      expect(repository.save).toHaveBeenCalledTimes(1);
      expect(result.display_name).toBe('Tên Mới');
      expect(result.bio).toBe('Bio mới');
      expect(result.username).toBe(profile.username);
      expect(
        (result as unknown as Record<string, unknown>).email,
      ).toBeUndefined();
    });

    it('đổi username hợp lệ (chưa ai dùng): cập nhật thành công', async () => {
      const profile = buildProfile();
      repository.findOne
        .mockResolvedValueOnce(profile) // findByUserId
        .mockResolvedValueOnce(null); // uniqueness check: không trùng ai

      const result = await service.updateProfile(profile.userId, {
        username: 'new_username',
      });

      expect(repository.findOne).toHaveBeenCalledTimes(2);
      expect(result.username).toBe('new_username');
    });

    it('username đã tồn tại (thuộc user khác): ném 409, không lưu', async () => {
      const profile = buildProfile();
      repository.findOne
        .mockResolvedValueOnce(profile) // findByUserId
        .mockResolvedValueOnce(buildProfile({ userId: 'other-user-id' })); // trùng

      await expect(
        service.updateProfile(profile.userId, { username: 'taken_username' }),
      ).rejects.toThrow(ConflictException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('user không còn tồn tại/không active (token hợp lệ nhưng phiên đã mất hiệu lực): ném 401, không lưu', async () => {
      repository.findOne.mockResolvedValueOnce(null); // findByUserId -> not found

      await expect(
        service.updateProfile('deleted-user-id', { display_name: 'X' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('body rỗng (không field nào): coi như no-op, vẫn trả hồ sơ hiện tại, không lưu field nào bị đổi', async () => {
      const profile = buildProfile();
      repository.findOne.mockResolvedValueOnce(profile);

      const result = await service.updateProfile(profile.userId, {});

      expect(result.display_name).toBe(profile.displayName);
      expect(result.bio).toBe(profile.bio);
      expect(result.username).toBe(profile.username);
    });
  });

  describe('createFromIdentity', () => {
    const createData = {
      userId: 'a3c9a6d0-1111-4b11-9c11-000000000001',
      role: UserRole.USER,
      identityCreatedAt: new Date('2026-01-01T00:00:00.000Z'),
      displayName: 'Người dùng Mới',
    };

    it('chưa có profile: insert (ON CONFLICT DO NOTHING) rồi trả về profile vừa tạo', async () => {
      repository.findOne.mockResolvedValue(buildProfile(createData));

      const result = await service.createFromIdentity(createData);

      expect(repository.insertQueryBuilder.insert).toHaveBeenCalled();
      expect(repository.insertQueryBuilder.values).toHaveBeenCalledWith(
        createData,
      );
      expect(repository.insertQueryBuilder.orIgnore).toHaveBeenCalled();
      expect(repository.insertQueryBuilder.execute).toHaveBeenCalled();
      expect(result.userId).toBe(createData.userId);
    });

    it('gọi lại với userId đã tồn tại (retry): idempotent, vẫn trả về đúng profile, không throw', async () => {
      repository.findOne.mockResolvedValue(buildProfile(createData));

      await expect(
        service.createFromIdentity(createData),
      ).resolves.toMatchObject({ userId: createData.userId });
    });
  });

  describe('deleteByUserId', () => {
    it('xoá profile tồn tại: gọi repository.delete với đúng userId', async () => {
      await service.deleteByUserId('a3c9a6d0-1111-4b11-9c11-000000000001');

      expect(repository.delete).toHaveBeenCalledWith({
        userId: 'a3c9a6d0-1111-4b11-9c11-000000000001',
      });
    });

    it('xoá userId không tồn tại: vẫn không throw (idempotent)', async () => {
      repository.delete.mockResolvedValue({ affected: 0, raw: [] });

      await expect(
        service.deleteByUserId('unknown-user-id'),
      ).resolves.toBeUndefined();
    });
  });
});
