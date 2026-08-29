import { UserRole } from '../enums/user-role.enum';

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
