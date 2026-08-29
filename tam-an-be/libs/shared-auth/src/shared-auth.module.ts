import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';

/**
 * Verify-only JWT wiring for any service behind JwtAuthGuard — trusts
 * only the claims in the token (`sub`, `role`), never touches a DB.
 * Requires `JWT_ACCESS_SECRET` in the consuming service's own config.
 */
@Module({
  imports: [PassportModule],
  providers: [JwtStrategy],
  exports: [PassportModule],
})
export class SharedAuthModule {}
