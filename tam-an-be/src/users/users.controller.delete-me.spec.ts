import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { UserRole } from './user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';

const ACCESS_SECRET = 'users-delete-me-test-secret-32-chars';

/**
 * Chứng minh AC "xoá khi chưa đăng nhập -> 401" của Issue #13 trên route
 * sản phẩm thật (DELETE /users/me).
 */
describe('UsersController DELETE /users/me (integration)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let deleteOwnAccountMock: jest.Mock;

  beforeAll(async () => {
    deleteOwnAccountMock = jest
      .fn()
      .mockResolvedValue({ message: 'Tài khoản đã được xoá' });

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ JWT_ACCESS_SECRET: ACCESS_SECRET })],
        }),
        PassportModule,
        JwtModule.register({
          secret: ACCESS_SECRET,
          signOptions: { expiresIn: '15m' },
        }),
      ],
      controllers: [UsersController],
      providers: [
        JwtStrategy,
        {
          provide: UsersService,
          useValue: {
            deleteOwnAccount: deleteOwnAccountMock,
            updateProfile: jest.fn(),
            getPublicProfileByUsername: jest.fn(),
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    jwtService = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('thiếu access token: 401, không gọi UsersService.deleteOwnAccount', async () => {
    await request(app.getHttpServer()).delete('/users/me').expect(401);
    expect(deleteOwnAccountMock).not.toHaveBeenCalled();
  });

  it('có access token hợp lệ: 200, gọi deleteOwnAccount với đúng userId', async () => {
    const token = jwtService.sign({ sub: 'user-1', role: UserRole.USER });

    await request(app.getHttpServer())
      .delete('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(deleteOwnAccountMock).toHaveBeenCalledWith('user-1');
  });
});
