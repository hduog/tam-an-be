import { AppDataSource } from '../data-source';
import { UserRole, UserStatus } from '@shared-auth';
import { AuthProvider, User } from '../../identity/user.entity';

/**
 * Dev/QA placeholder — real password hashing lands with the register endpoint (next issue).
 */
const PLACEHOLDER_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$c2VlZHNhbHRzZWVkc2FsdA$c2VlZHBsYWNlaG9sZGVyaGFzaHZhbHVl';

interface SeedUser {
  email: string;
  role: UserRole;
  status: UserStatus;
  provider: AuthProvider;
  passwordHash: string | null;
  providerId: string | null;
  emailVerifiedAt: Date | null;
}

const seedUsers: SeedUser[] = [
  {
    email: 'admin@tam-an.dev',
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
    provider: AuthProvider.LOCAL,
    passwordHash: PLACEHOLDER_PASSWORD_HASH,
    providerId: null,
    emailVerifiedAt: new Date(),
  },
  {
    email: 'expert@tam-an.dev',
    role: UserRole.EXPERT,
    status: UserStatus.ACTIVE,
    provider: AuthProvider.LOCAL,
    passwordHash: PLACEHOLDER_PASSWORD_HASH,
    providerId: null,
    emailVerifiedAt: new Date(),
  },
  {
    email: 'user.verified@tam-an.dev',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    provider: AuthProvider.LOCAL,
    passwordHash: PLACEHOLDER_PASSWORD_HASH,
    providerId: null,
    emailVerifiedAt: new Date(),
  },
  {
    email: 'user.unverified@tam-an.dev',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    provider: AuthProvider.LOCAL,
    passwordHash: PLACEHOLDER_PASSWORD_HASH,
    providerId: null,
    emailVerifiedAt: null,
  },
  {
    email: 'user.google@tam-an.dev',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    provider: AuthProvider.GOOGLE,
    passwordHash: null,
    providerId: 'google-oauth2|1234567890',
    emailVerifiedAt: new Date(),
  },
];

async function run() {
  await AppDataSource.initialize();
  const repo = AppDataSource.getRepository(User);

  for (const seed of seedUsers) {
    const existing = await repo.findOne({ where: { email: seed.email } });
    if (existing) {
      console.log(`skip (already exists): ${seed.email}`);
      continue;
    }
    const user = repo.create(seed);
    await repo.save(user);
    console.log(`seeded: ${seed.email} (${seed.role})`);
  }

  await AppDataSource.destroy();
}

run().catch((error) => {
  console.error('Seed failed:', error);
  process.exitCode = 1;
});
