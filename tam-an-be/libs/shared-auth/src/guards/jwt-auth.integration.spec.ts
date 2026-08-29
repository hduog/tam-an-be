import {
  Controller,
  ForbiddenException,
  Get,
  INestApplication,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { UserRole } from '../enums/user-role.enum';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';
import { AuthenticatedUser } from '../interfaces/jwt-payload.interface';
import { JwtStrategy } from '../jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';

const ACCESS_SECRET = 'integration-test-secret-of-32-chars!!';

/**
 * Throwaway routes demonstrating the 3 access tiers from Issue #09 —
 * exists only in this spec to prove the guard chain end-to-end, without
 * inventing real product endpoints ahead of the issues that own them
 * (#08 GET /auth/me, #12/#13 /users/me).
 */
@Controller('__test')
class DemoController {
  // "User" tier: any authenticated user.
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  // "Owner" tier: authenticated + must own the :userId resource.
  @Get('owner/:userId')
  @UseGuards(JwtAuthGuard)
  ownerOnly(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
  ) {
    if (user.id !== userId) {
      throw new ForbiddenException('Not the resource owner');
    }
    return { ok: true };
  }

  // Role-gated tier: authenticated + must have an allowed role.
  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  adminOnly() {
    return { ok: true };
  }
}

describe('JWT Guard chain (integration)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
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
      controllers: [DemoController],
      providers: [JwtStrategy],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    jwtService = moduleRef.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  const sign = (payload: object, options?: Record<string, unknown>) =>
    jwtService.sign(payload, options);

  it('User tier — token hợp lệ: 200', async () => {
    const token = sign({ sub: 'user-1', role: UserRole.USER });

    await request(app.getHttpServer())
      .get('/__test/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect({ id: 'user-1', role: UserRole.USER });
  });

  it('User tier — thiếu token: 401', async () => {
    await request(app.getHttpServer()).get('/__test/me').expect(401);
  });

  it('User tier — token hết hạn: 401', async () => {
    const token = sign(
      { sub: 'user-1', role: UserRole.USER },
      { expiresIn: '-1s' },
    );

    await request(app.getHttpServer())
      .get('/__test/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(401);
  });

  it('User tier — token sai chữ ký: 401', async () => {
    const foreignToken = new JwtService({
      secret: 'a-completely-different-secret',
    }).sign({ sub: 'user-1', role: UserRole.USER });

    await request(app.getHttpServer())
      .get('/__test/me')
      .set('Authorization', `Bearer ${foreignToken}`)
      .expect(401);
  });

  it('Owner tier — đúng chủ sở hữu resource: 200', async () => {
    const token = sign({ sub: 'user-1', role: UserRole.USER });

    await request(app.getHttpServer())
      .get('/__test/owner/user-1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });

  it('Owner tier — không phải chủ sở hữu: 403', async () => {
    const token = sign({ sub: 'user-1', role: UserRole.USER });

    await request(app.getHttpServer())
      .get('/__test/owner/someone-else')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('Role tier — sai role: 403', async () => {
    const token = sign({ sub: 'user-1', role: UserRole.USER });

    await request(app.getHttpServer())
      .get('/__test/admin')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('Role tier — đúng role: 200', async () => {
    const token = sign({ sub: 'admin-1', role: UserRole.ADMIN });

    await request(app.getHttpServer())
      .get('/__test/admin')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
  });
});
