import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';

export const ROLES_KEY = 'roles';

/** Restricts an endpoint (already behind JwtAuthGuard) to specific roles. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
