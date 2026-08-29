import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { UserRole } from '@shared-auth';
import { InternalUsersController } from './internal-users.controller';
import { ProfilesService } from './profiles.service';

const INTERNAL_API_KEY = 'x'.repeat(32);

describe('InternalUsersController (integration)', () => {
  let app: INestApplication<App>;
  let createFromIdentityMock: jest.Mock;
  let deleteByUserIdMock: jest.Mock;

  beforeAll(async () => {
    createFromIdentityMock = jest.fn().mockResolvedValue(undefined);
    deleteByUserIdMock = jest.fn().mockResolvedValue(undefined);

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ INTERNAL_API_KEY })],
        }),
      ],
      controllers: [InternalUsersController],
      providers: [
        {
          provide: ProfilesService,
          useValue: {
            createFromIdentity: createFromIdentityMock,
            deleteByUserId: deleteByUserIdMock,
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /internal/users', () => {
    it('thiếu/sai X-Internal-Api-Key: 401, không gọi ProfilesService', async () => {
      await request(app.getHttpServer())
        .post('/internal/users')
        .send({
          user_id: 'a3c9a6d0-1111-4b11-9c11-000000000001',
          role: UserRole.USER,
          identity_created_at: '2026-01-01T00:00:00.000Z',
          display_name: 'Người dùng',
        })
        .expect(401);
      expect(createFromIdentityMock).not.toHaveBeenCalled();
    });

    it('đúng key: 201, gọi createFromIdentity với đúng dữ liệu', async () => {
      await request(app.getHttpServer())
        .post('/internal/users')
        .set('X-Internal-Api-Key', INTERNAL_API_KEY)
        .send({
          user_id: 'a3c9a6d0-1111-4b11-9c11-000000000001',
          role: UserRole.USER,
          identity_created_at: '2026-01-01T00:00:00.000Z',
          display_name: 'Người dùng',
        })
        .expect(201);

      expect(createFromIdentityMock).toHaveBeenCalledWith({
        userId: 'a3c9a6d0-1111-4b11-9c11-000000000001',
        role: UserRole.USER,
        identityCreatedAt: new Date('2026-01-01T00:00:00.000Z'),
        displayName: 'Người dùng',
      });
    });
  });

  describe('DELETE /internal/users/:userId', () => {
    it('thiếu/sai X-Internal-Api-Key: 401, không gọi ProfilesService', async () => {
      await request(app.getHttpServer())
        .delete('/internal/users/a3c9a6d0-1111-4b11-9c11-000000000001')
        .expect(401);
      expect(deleteByUserIdMock).not.toHaveBeenCalled();
    });

    it('đúng key: 200, gọi deleteByUserId với đúng userId', async () => {
      await request(app.getHttpServer())
        .delete('/internal/users/a3c9a6d0-1111-4b11-9c11-000000000001')
        .set('X-Internal-Api-Key', INTERNAL_API_KEY)
        .expect(200);

      expect(deleteByUserIdMock).toHaveBeenCalledWith(
        'a3c9a6d0-1111-4b11-9c11-000000000001',
      );
    });
  });
});
