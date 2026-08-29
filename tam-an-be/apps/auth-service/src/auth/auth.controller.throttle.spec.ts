import { INestApplication } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

/**
 * Chứng minh AC "áp dụng rate limiting chống brute-force" của Issue #03,
 * và AC (b) "áp dụng rate limiting cho /auth/login và /auth/register" của
 * Issue #14: quá số lần thử cho phép trong cửa sổ thời gian -> 429, không
 * gọi tới AuthService nữa (không tiếp tục dò mật khẩu / spam đăng ký).
 */
describe('AuthController rate limiting (integration)', () => {
  let app: INestApplication<App>;
  let loginMock: jest.Mock;
  let registerMock: jest.Mock;

  beforeAll(async () => {
    loginMock = jest.fn().mockResolvedValue({
      access_token: 'a',
      refresh_token: 'b',
      user: { id: 'u1' },
    });
    registerMock = jest.fn().mockResolvedValue({ id: 'u1' });

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }])],
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: { login: loginMock, register: registerMock },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/auth/login: cho phép tối đa 5 request/60s, request thứ 6 bị chặn 429', async () => {
    const payload = { email: 'a@b.com', password: 'whatever' };

    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send(payload)
        .expect(200);
    }

    await request(app.getHttpServer())
      .post('/auth/login')
      .send(payload)
      .expect(429);

    expect(loginMock).toHaveBeenCalledTimes(5);
  });

  it('/auth/register: cho phép tối đa 5 request/60s, request thứ 6 bị chặn 429', async () => {
    const payload = {
      email: 'new@b.com',
      password: 'Passw0rd123',
      display_name: 'X',
    };

    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send(payload)
        .expect(201);
    }

    await request(app.getHttpServer())
      .post('/auth/register')
      .send(payload)
      .expect(429);

    expect(registerMock).toHaveBeenCalledTimes(5);
  });
});
