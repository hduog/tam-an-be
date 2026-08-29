import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtStrategy, UserRole } from '@shared-auth';
import { generateTestRsaKeyPair } from '@shared-auth/testing/rsa-test-keypair';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const { privateKeyPem } = generateTestRsaKeyPair();

/**
 * Chứng minh AC "token hợp lệ / hết hạn / thiếu token" của Issue #08 trên
 * chính route sản phẩm thật (GET /auth/me), không phải route demo.
 */
describe('AuthController GET /auth/me (integration)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let meMock: jest.Mock;

  beforeAll(async () => {
    meMock = jest.fn().mockResolvedValue({
      id: 'user-1',
      email: 'me@tam-an.dev',
      role: UserRole.USER,
      email_verified_at: null,
      status: 'active',
    });

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ JWT_PRIVATE_KEY: privateKeyPem })],
        }),
        PassportModule,
        JwtModule.register({
          privateKey: privateKeyPem,
          signOptions: { expiresIn: '15m', algorithm: 'RS256' },
        }),
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }]),
      ],
      controllers: [AuthController],
      providers: [
        JwtStrategy,
        { provide: AuthService, useValue: { me: meMock } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    jwtService = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('token hợp lệ: 200, trả đúng thông tin từ AuthService.me', async () => {
    const token = jwtService.sign({ sub: 'user-1', role: UserRole.USER });

    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(meMock).toHaveBeenCalledWith('user-1');
    const body = response.body as Record<string, unknown>;
    expect(body).toMatchObject({ id: 'user-1' });
    expect(body.password_hash).toBeUndefined();
  });

  it('thiếu token: 401, không gọi AuthService.me', async () => {
    meMock.mockClear();
    await request(app.getHttpServer()).get('/auth/me').expect(401);
    expect(meMock).not.toHaveBeenCalled();
  });

  it('token hết hạn: 401, không gọi AuthService.me', async () => {
    meMock.mockClear();
    const expiredToken = jwtService.sign(
      { sub: 'user-1', role: UserRole.USER },
      { expiresIn: '-1s' },
    );

    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);
    expect(meMock).not.toHaveBeenCalled();
  });
});
