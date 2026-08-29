import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitUsersDb1787989200000 implements MigrationInterface {
  name = 'InitUsersDb1787989200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."user_role" AS ENUM('user', 'expert', 'admin')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'deleted')`,
    );

    await queryRunner.query(
      `CREATE TABLE "user_profiles" (
        "user_id" uuid NOT NULL,
        "username" character varying(60),
        "display_name" character varying(120) NOT NULL,
        "avatar_url" text,
        "bio" text,
        "role" "public"."user_role" NOT NULL DEFAULT 'user',
        "status" "public"."user_status" NOT NULL DEFAULT 'active',
        "identity_created_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_user_profiles_username" UNIQUE ("username"),
        CONSTRAINT "PK_user_profiles_user_id" PRIMARY KEY ("user_id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_profiles_role" ON "user_profiles" ("role")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "user_profiles"`);
    await queryRunner.query(`DROP TYPE "public"."user_status"`);
    await queryRunner.query(`DROP TYPE "public"."user_role"`);
  }
}
