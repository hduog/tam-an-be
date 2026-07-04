# Init dự án `tam-an-be`

Checklist các bước khởi tạo dự án NestJS + PostgreSQL (TypeORM).

## 1. Khởi tạo project

```bash
npm i -g @nestjs/cli
nest new tam-an-be
cd tam-an-be
```

## 2. Cài package cần thiết

```bash
npm install @nestjs/typeorm typeorm pg
npm install @nestjs/config joi
npm install class-validator class-transformer
npm install typeorm-naming-strategies
```

## 3. Tạo docker-compose cho PostgreSQL local

Tạo file `docker-compose.yml`:

```yaml
services:
  postgres:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_USER: tam_an
      POSTGRES_PASSWORD: tam_an_password
      POSTGRES_DB: tam_an_be_db
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

Chạy:

```bash
docker compose up -d
```

## 4. Tạo file `.env`

```
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USER=tam_an
DATABASE_PASSWORD=tam_an_password
DATABASE_NAME=tam_an_be_db
NODE_ENV=development
```

Thêm `.env` vào `.gitignore`.

## 5. Tạo validate schema cho env

File `src/config/env.validation.ts`:

```typescript
import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  DATABASE_HOST: Joi.string().required(),
  DATABASE_PORT: Joi.number().default(5432),
  DATABASE_USER: Joi.string().required(),
  DATABASE_PASSWORD: Joi.string().required(),
  DATABASE_NAME: Joi.string().required(),
});
```

## 6. Tạo DataSource dùng cho migration CLI

File `src/database/data-source.ts`:

```typescript
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as dotenv from 'dotenv';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/database/migrations/*.js'],
  namingStrategy: new SnakeNamingStrategy(),
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
```

## 7. Đăng ký `ConfigModule` + `TypeOrmModule` trong `app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { envValidationSchema } from './config/env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DATABASE_HOST'),
        port: config.get('DATABASE_PORT'),
        username: config.get('DATABASE_USER'),
        password: config.get('DATABASE_PASSWORD'),
        database: config.get('DATABASE_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        namingStrategy: new SnakeNamingStrategy(),
        synchronize: false,
        extra: { max: 20 },
      }),
    }),
  ],
})
export class AppModule {}
```

## 8. Thêm script migration vào `package.json`

```json
{
  "scripts": {
    "typeorm": "typeorm-ts-node-commonjs -d src/database/data-source.ts",
    "migration:generate": "npm run typeorm -- migration:generate",
    "migration:run": "npm run typeorm -- migration:run",
    "migration:revert": "npm run typeorm -- migration:revert"
  }
}
```

## 9. Tạo entity đầu tiên (ví dụ `User`)

```bash
mkdir -p src/users
```

File `src/users/user.entity.ts`:

```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  fullName: string;

  @CreateDateColumn()
  createdAt: Date;
}
```

## 10. Generate và chạy migration đầu tiên

```bash
npm run build
npm run migration:generate src/database/migrations/InitUsers
npm run migration:run
```

## 11. Tạo module theo chuẩn NestJS

```bash
nest g module users
nest g controller users
nest g service users
```

File `src/users/users.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
```

## 12. Bật global validation pipe

File `src/main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

## 13. Kiểm tra chạy thử

```bash
npm run start:dev
```

- Kiểm tra kết nối DB thành công (không có lỗi trong log).
- Test endpoint mẫu (`GET /users`) nếu đã có.

## 14. (Tuỳ chọn) Việc cần làm tiếp theo

- [ ] Thêm transaction helper (`DataSource.transaction()` hoặc `QueryRunner`)
- [ ] Thêm Swagger (`@nestjs/swagger`)
- [ ] Thêm exception filter / interceptor chuẩn hoá response
- [ ] Thêm test container cho Postgres khi viết e2e test
- [ ] Thêm CI pipeline chạy migration + test tự động
