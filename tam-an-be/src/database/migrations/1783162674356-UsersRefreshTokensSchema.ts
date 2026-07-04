import { MigrationInterface, QueryRunner } from 'typeorm';

export class UsersRefreshTokensSchema1783162674356 implements MigrationInterface {
  name = 'UsersRefreshTokensSchema1783162674356';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // a) Enums
    await queryRunner.query(
      `CREATE TYPE "public"."user_role" AS ENUM('user', 'expert', 'admin')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."user_status" AS ENUM('active', 'suspended', 'deleted')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."auth_provider" AS ENUM('local', 'google', 'apple')`,
    );

    // b) users — widen/retype existing S0 columns without losing data, then add new columns
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "email" TYPE character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" RENAME COLUMN "full_name" TO "display_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "display_name" TYPE character varying(120)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "created_at" TYPE TIMESTAMP WITH TIME ZONE USING "created_at" AT TIME ZONE 'UTC'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "created_at" SET DEFAULT now()`,
    );

    await queryRunner.query(
      `ALTER TABLE "users" ADD "password_hash" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "role" "public"."user_role" NOT NULL DEFAULT 'user'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "username" character varying(60)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710" UNIQUE ("username")`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "avatar_url" text`);
    await queryRunner.query(`ALTER TABLE "users" ADD "bio" text`);
    await queryRunner.query(
      `ALTER TABLE "users" ADD "provider" "public"."auth_provider" NOT NULL DEFAULT 'local'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "provider_id" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "email_verified_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "status" "public"."user_status" NOT NULL DEFAULT 'active'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`,
    );

    // d) users indexes
    await queryRunner.query(
      `CREATE INDEX "IDX_ace513fa30d485cfd25c11a9e4" ON "users" ("role") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3676155292d72c67cd4e090514" ON "users" ("status") `,
    );

    // c) refresh_tokens
    await queryRunner.query(
      `CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "token_hash" character varying(255) NOT NULL, "device_info" text, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "user_id" uuid NOT NULL, CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3ddc983c5f7bcf132fd8732c3f" ON "refresh_tokens" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a7838d2ba25be1342091b6695f" ON "refresh_tokens" ("token_hash") `,
    );
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);

    await queryRunner.query(
      `DROP INDEX "public"."IDX_3676155292d72c67cd4e090514"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_ace513fa30d485cfd25c11a9e4"`,
    );

    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "deleted_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "updated_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "status"`);
    await queryRunner.query(`DROP TYPE "public"."user_status"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "email_verified_at"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "provider_id"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "provider"`);
    await queryRunner.query(`DROP TYPE "public"."auth_provider"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "bio"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "avatar_url"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "UQ_fe0bb3f6520ee0469504521e710"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "username"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role"`);
    await queryRunner.query(`DROP TYPE "public"."user_role"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "password_hash"`);

    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "created_at" TYPE TIMESTAMP USING "created_at" AT TIME ZONE 'UTC'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "created_at" SET DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "display_name" TYPE character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" RENAME COLUMN "display_name" TO "full_name"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ALTER COLUMN "email" TYPE character varying`,
    );
  }
}
