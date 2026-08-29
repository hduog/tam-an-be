import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { UserRole } from '../users/user.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

const ACCESS_SECRET = 'logout-endpoint-test-secret-of-32-chars!';

/**
 * Chứng minh AC "thiếu access token -> 401" của Issue #06 trên route
 * sản phẩm thật. Case "logout thành công" và "token đã thu hồi" (idempotent)
 * đã cover ở tầng service (auth.service.spec.ts) + token.service.spec.ts.
 */
describe('AuthController POST /auth/logout (integration)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let logoutMock: jest.Mock;

  beforeAll(async () => {
    logoutMock = jest
      .fn()
      .mockResolvedValue({ message: 'Đăng xuất thành công' });

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
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }]),
      ],
      controllers: [AuthController],
      providers: [
        JwtStrategy,
        { provide: AuthService, useValue: { logout: logoutMock } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    jwtService = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('thiếu access token: 401, không gọi AuthService.logout', async () => {
    await request(app.getHttpServer())
      .post('/auth/logout')
      .send({ refresh_token: 'some-refresh-token' })
      .expect(401);
    expect(logoutMock).not.toHaveBeenCalled();
  });

  it('có access token hợp lệ: 200, gọi AuthService.logout với đúng userId + refresh_token', async () => {
    const token = jwtService.sign({ sub: 'user-1', role: UserRole.USER });

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${token}`)
      .send({ refresh_token: 'some-refresh-token' })
      .expect(200);

    expect(logoutMock).toHaveBeenCalledWith('user-1', {
      refresh_token: 'some-refresh-token',
    });
  });
});
