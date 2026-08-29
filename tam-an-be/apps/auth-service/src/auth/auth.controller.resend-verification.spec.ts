import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtStrategy, UserRole } from '@shared-auth';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const ACCESS_SECRET = 'resend-verification-test-secret-32-c';

/**
 * Chứng minh guard hoạt động trên route sản phẩm thật
 * (POST /auth/resend-verification-email) — case còn lại (gửi lại thành
 * công, đã xác thực trước đó) đã cover ở tầng service.
 */
describe('AuthController POST /auth/resend-verification-email (integration)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let resendMock: jest.Mock;

  beforeAll(async () => {
    resendMock = jest
      .fn()
      .mockResolvedValue({ message: 'Đã gửi lại email xác thực' });

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
        {
          provide: AuthService,
          useValue: { resendVerificationEmail: resendMock },
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

  it('thiếu access token: 401, không gọi AuthService.resendVerificationEmail', async () => {
    await request(app.getHttpServer())
      .post('/auth/resend-verification-email')
      .expect(401);
    expect(resendMock).not.toHaveBeenCalled();
  });

  it('có access token hợp lệ: 200, gọi resendVerificationEmail với đúng userId', async () => {
    const token = jwtService.sign({ sub: 'user-1', role: UserRole.USER });

    await request(app.getHttpServer())
      .post('/auth/resend-verification-email')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(resendMock).toHaveBeenCalledWith('user-1');
  });
});
