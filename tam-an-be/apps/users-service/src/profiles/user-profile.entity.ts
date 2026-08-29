import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole, UserStatus } from '@shared-auth';

/**
 * `user_id` không phải khoá ngoại Postgres thật — auth-service và
 * users-service là 2 DB riêng biệt. Giá trị luôn được copy từ
 * auth-service lúc tạo tài khoản (claim `sub` trong JWT), không bao giờ
 * tự sinh ở đây.
 */
@Entity('user_profiles')
export class UserProfile {
  @PrimaryColumn('uuid')
  userId: string;

  @Column({ type: 'varchar', length: 60, unique: true, nullable: true })
  username: string | null;

  @Column({ type: 'varchar', length: 120 })
  displayName: string;

  @Column({ type: 'text', nullable: true })
  avatarUrl: string | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  // Denormalized từ auth-service — tránh gọi cross-service trên hot path
  // đọc công khai (GET /users/:username). Đồng bộ qua internal API khi
  // identity thay đổi (xem #04 giai đoạn "Nối luồng xuyên service").
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
    enum: UserStatus,
    enumName: 'user_status',
    default: UserStatus.ACTIVE,
  })
  status: UserStatus;

  @Column({ type: 'timestamptz' })
  identityCreatedAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
