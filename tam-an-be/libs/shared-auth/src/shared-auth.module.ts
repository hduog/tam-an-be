import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './jwt.strategy';

/**
 * Verify-only JWT wiring for any service behind JwtAuthGuard — trusts
 * only the claims in the token (`sub`, `role`), never touches a DB.
 * RS256 verification, 2 modes chosen by `JwtStrategy` based on which env
 * var the consuming service provides: `JWT_PRIVATE_KEY` (auth-service —
 * verifies locally) or `AUTH_JWKS_URI` (every other service — verifies
 * via auth-service's `GET /auth/jwks.json`).
 */
@Module({
  imports: [PassportModule],
  providers: [JwtStrategy],
  exports: [PassportModule],
})
export class SharedAuthModule {}
