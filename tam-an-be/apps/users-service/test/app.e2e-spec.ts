import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { UsersServiceModule } from './../src/users-service.module';

describe('ProfilesController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [UsersServiceModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/users/me (PATCH) không có token: 401', () => {
    return request(app.getHttpServer()).patch('/users/me').expect(401);
  });

  afterEach(async () => {
    await app.close();
  });
});
