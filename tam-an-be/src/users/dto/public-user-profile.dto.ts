import { UserRole } from '../user.entity';

/**
 * Public-facing user profile. Only whitelisted fields belong here —
 * never spread the User entity directly, to avoid leaking sensitive
 * columns (email, passwordHash, ...) as the entity grows.
 * Extend with more fields (expert profile, follow/feed counters, ...)
 * in later sprints without breaking existing consumers.
 */
export class PublicUserProfileDto {
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  role: UserRole;
  createdAt: Date;
}
