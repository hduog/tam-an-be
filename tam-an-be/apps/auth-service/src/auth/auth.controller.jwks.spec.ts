import { INestApplication } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

/**
 * Chứng minh route public GET /auth/jwks.json trên route sản phẩm thật —
 * không cần token, trả đúng shape từ AuthService.getJwks(). Nội dung
 * JWK/round-trip verify đã cover kỹ ở token.service.spec.ts.
 */
describe('AuthController GET /auth/jwks.json (integration)', () => {
  let app: INestApplication<App>;
  let jwksMock: jest.Mock;

  beforeAll(async () => {
    jwksMock = jest.fn().mockReturnValue({
      keys: [
        {
          kty: 'RSA',
          n: 'fake-n',
          e: 'AQAB',
          kid: 'auth-key-1',
          use: 'sig',
          alg: 'RS256',
        },
      ],
    });

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }])],
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: { getJwks: jwksMock } }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('không cần token: 200, trả đúng shape { keys: [...] } từ AuthService.getJwks', async () => {
    const response = await request(app.getHttpServer())
      .get('/auth/jwks.json')
      .expect(200);

    expect(jwksMock).toHaveBeenCalledTimes(1);
    const body = response.body as { keys: unknown[] };
    expect(body.keys).toHaveLength(1);
    expect(body.keys[0]).toMatchObject({ kty: 'RSA', kid: 'auth-key-1' });
  });
});
