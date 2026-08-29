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
import { EmailVerificationTokenService } from './email-verification-token.service';
import { ConsoleMailerService } from './mailer/console-mailer.service';
import { SendGridMailerService } from './mailer/sendgrid-mailer.service';
import { MAILER } from './mailer/mailer.token';
import type { Mailer } from './interfaces/mailer.interface';

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
    EmailVerificationTokenService,
    ConsoleMailerService,
    SendGridMailerService,
    {
      provide: MAILER,
      inject: [ConfigService, SendGridMailerService, ConsoleMailerService],
      useFactory: (
        config: ConfigService,
        sendGrid: SendGridMailerService,
        consoleMailer: ConsoleMailerService,
      ): Mailer =>
        // Có SENDGRID_API_KEY -> dùng SendGrid thật; không có (local dev,
        // test) -> fallback log ra console, không chặn khởi động app.
        config.get<string>('SENDGRID_API_KEY') ? sendGrid : consoleMailer,
    },
  ],
  exports: [JwtModule, TokenService],
})
export class AuthModule {}
