import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { envValidationSchema } from './config/env.validation';
import { ProfilesModule } from './profiles/profiles.module';

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
        host: config.get('USERS_DB_HOST'),
        port: config.get('USERS_DB_PORT'),
        username: config.get('USERS_DB_USER'),
        password: config.get('USERS_DB_PASSWORD'),
        database: config.get('USERS_DB_NAME'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        namingStrategy: new SnakeNamingStrategy(),
        synchronize: false,
        extra: { max: 20 },
        uuidExtension: 'pgcrypto',
      }),
    }),
    ProfilesModule,
  ],
})
export class UsersServiceModule {}
