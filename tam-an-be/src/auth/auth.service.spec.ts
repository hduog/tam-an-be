import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthProvider, User, UserRole, UserStatus } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<Pick<UsersService, 'findByEmail' | 'create'>>;

  const registerDto: RegisterDto = {
    email: 'new.user@tam-an.dev',
    password: 'Passw0rd123',
    display_name: 'Người dùng Mới',
  };

  beforeEach(async () => {
    usersService = {
      findByEmail: jest.fn(),
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('đăng ký thành công: tạo user mới, hash password, không trả password_hash', async () => {
    usersService.findByEmail.mockResolvedValue(null);
    const createdUser: User = {
      id: 'user-id-1',
      email: registerDto.email,
      passwordHash: 'hashed-password',
      role: UserRole.USER,
      displayName: registerDto.display_name,
      username: null,
      avatarUrl: null,
      bio: null,
      provider: AuthProvider.LOCAL,
      providerId: null,
      emailVerifiedAt: null,
      status: UserStatus.ACTIVE,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      deletedAt: null,
    };
    usersService.create.mockResolvedValue(createdUser);

    const result = await service.register(registerDto);

    expect(usersService.findByEmail).toHaveBeenCalledWith(registerDto.email);
    expect(usersService.create).toHaveBeenCalledTimes(1);
    const createArg = usersService.create.mock.calls[0][0];
    expect(createArg.email).toBe(registerDto.email);
    expect(createArg.displayName).toBe(registerDto.display_name);
    expect(createArg.role).toBe(UserRole.USER);
    expect(createArg.status).toBe(UserStatus.ACTIVE);
    expect(createArg.provider).toBe(AuthProvider.LOCAL);
    expect(createArg.passwordHash).not.toBe(registerDto.password);
    expect(createArg.passwordHash).toMatch(/^\$argon2id\$/);

    expect(result).toEqual({
      id: createdUser.id,
      email: createdUser.email,
      display_name: createdUser.displayName,
      role: createdUser.role,
      status: createdUser.status,
      provider: createdUser.provider,
      email_verified_at: createdUser.emailVerifiedAt,
      created_at: createdUser.createdAt,
    });
    expect(
      (result as unknown as Record<string, unknown>).passwordHash,
    ).toBeUndefined();
    expect(
      (result as unknown as Record<string, unknown>).password_hash,
    ).toBeUndefined();
  });

  it('trùng email: ném ConflictException và không tạo user mới', async () => {
    usersService.findByEmail.mockResolvedValue({
      id: 'existing-id',
    } as User);

    await expect(service.register(registerDto)).rejects.toThrow(
      ConflictException,
    );
    expect(usersService.create).not.toHaveBeenCalled();
  });
});
