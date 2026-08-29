import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Protects an endpoint with the JWT strategy. Apply per-route/controller
 * via `@UseGuards(JwtAuthGuard)` — see documents/auth-guard-guide.md.
 * `@Public()` only has an effect if this guard is ever registered
 * globally (e.g. via APP_GUARD in a later sprint); it's a no-op guard-less
 * class today so it exists ahead of time without changing behavior.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  // Passport calls this with (err, user, info) regardless of outcome —
  // normalize every failure path (missing/invalid/expired token) to a
  // single, unambiguous 401 instead of leaking passport-jwt internals.
  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser | false,
    info: { message?: string } | undefined,
  ): TUser {
    if (err || !user) {
      throw new UnauthorizedException(
        (info?.message as string) ?? 'Unauthorized',
      );
    }
    return user;
  }
}
