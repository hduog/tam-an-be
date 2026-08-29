import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtStrategy, UserRole } from '@shared-auth';
import { generateTestRsaKeyPair } from '@shared-auth/testing/rsa-test-keypair';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

// Production dùng JWKS-remote (AUTH_JWKS_URI), nhưng test này chỉ cần
// chứng minh JwtAuthGuard accept/reject đúng token RS256 trên route thật
// — dùng chế độ local-key (JWT_PRIVATE_KEY) đơn giản hơn, không cần mock
// jwks-rsa. Cơ chế fetch JWKS tự nó được test riêng ở jwt.strategy.spec.ts.
const { privateKeyPem } = generateTestRsaKeyPair();

/**
 * Chứng minh AC "yêu cầu access token hợp lệ" của Issue #12 trên route
 * sản phẩm thật (PATCH /users/me).
 */
describe('ProfilesController PATCH /users/me (integration)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let updateProfileMock: jest.Mock;

  beforeAll(async () => {
    updateProfileMock = jest.fn().mockResolvedValue({
      user_id: 'user-1',
      username: 'demo_user',
      display_name: 'Tên Mới',
      avatar_url: null,
      bio: null,
      role: UserRole.USER,
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
      ],
      controllers: [ProfilesController],
      providers: [
        JwtStrategy,
        {
          provide: ProfilesService,
          useValue: {
            updateProfile: updateProfileMock,
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

  it('thiếu access token: 401, không gọi ProfilesService.updateProfile', async () => {
    await request(app.getHttpServer())
      .patch('/users/me')
      .send({ display_name: 'Tên Mới' })
      .expect(401);
    expect(updateProfileMock).not.toHaveBeenCalled();
  });

  it('có access token hợp lệ: 200, gọi updateProfile với đúng userId + body', async () => {
    const token = jwtService.sign({ sub: 'user-1', role: UserRole.USER });

    await request(app.getHttpServer())
      .patch('/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ display_name: 'Tên Mới' })
      .expect(200);

    expect(updateProfileMock).toHaveBeenCalledWith('user-1', {
      display_name: 'Tên Mới',
    });
  });
});
