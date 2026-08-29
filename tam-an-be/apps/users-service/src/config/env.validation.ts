import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  USERS_DB_HOST: Joi.string().required(),
  USERS_DB_PORT: Joi.number().default(5432),
  USERS_DB_USER: Joi.string().required(),
  USERS_DB_PASSWORD: Joi.string().required(),
  USERS_DB_NAME: Joi.string().required(),
  // Xác thực JWT cục bộ — dùng chung secret với auth-service cho tới khi
  // chuyển sang RSA/JWKS (giai đoạn 3 của kế hoạch tách microservice).
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
});
