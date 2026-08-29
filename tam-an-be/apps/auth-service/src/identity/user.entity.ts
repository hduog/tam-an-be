import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole, UserStatus } from '@shared-auth';

export enum AuthProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
  APPLE = 'apple',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  passwordHash: string | null;

  @Index()
  @Column({
    type: 'enum',
    enum: UserRole,
    enumName: 'user_role',
    default: UserRole.USER,
  })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: AuthProvider,
    enumName: 'auth_provider',
    default: AuthProvider.LOCAL,
  })
  provider: AuthProvider;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  @Index()
  @Column({
    type: 'enum',
    enum: UserStatus,
    enumName: 'user_status',
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;
}
