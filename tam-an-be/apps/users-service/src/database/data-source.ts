import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as dotenv from 'dotenv';

dotenv.config();

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.USERS_DB_HOST,
  port: Number(process.env.USERS_DB_PORT),
  username: process.env.USERS_DB_USER,
  password: process.env.USERS_DB_PASSWORD,
  database: process.env.USERS_DB_NAME,
  entities: [__dirname + '/../**/*.entity.ts'],
  migrations: [__dirname + '/migrations/*.ts'],
  namingStrategy: new SnakeNamingStrategy(),
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  uuidExtension: 'pgcrypto',
});
