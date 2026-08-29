import { UserRole } from '../../users/user.entity';

/** Minimal JWT payload — kept small so the token itself stays lightweight. */
export interface JwtPayload {
  sub: string;
  role: UserRole;
}

/** Shape attached to `req.user` by JwtStrategy once a token is verified. */
export interface AuthenticatedUser {
  id: string;
  role: UserRole;
}
