import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ThrottlerModule } from '@nestjs/throttler';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TokenService } from './token.service';
import { GoogleTokenVerifierService } from './social/google-token-verifier.service';
import { AppleTokenVerifierService } from './social/apple-token-verifier.service';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => {
        // `expiresIn` accepts a "15m"-style duration string at runtime
        // (via the `ms` package); @nestjs/jwt's type just isn't `string`.
        const expiresIn = config.get<string>(
          'JWT_ACCESS_EXPIRES_IN',
          '15m',
        ) as NonNullable<JwtModuleOptions['signOptions']>['expiresIn'];
        return {
          secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
          signOptions: { expiresIn },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    TokenService,
    GoogleTokenVerifierService,
    AppleTokenVerifierService,
  ],
  exports: [JwtModule, TokenService],
})
export class AuthModule {}
