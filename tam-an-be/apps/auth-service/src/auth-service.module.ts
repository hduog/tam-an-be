import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { envValidationSchema } from './config/env.validation';
import { AuthModule } from './auth/auth.module';

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
        host: config.get('AUTH_DB_HOST'),
        port: config.get('AUTH_DB_PORT'),
        username: config.get('AUTH_DB_USER'),
        password: config.get('AUTH_DB_PASSWORD'),
        database: config.get('AUTH_DB_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        namingStrategy: new SnakeNamingStrategy(),
        synchronize: false,
        extra: { max: 20 },
        uuidExtension: 'pgcrypto',
      }),
    }),
    AuthModule,
  ],
})
export class AuthServiceModule {}
