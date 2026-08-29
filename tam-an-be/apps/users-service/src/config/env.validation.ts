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
  // Xác thực JWT cục bộ qua JWKS thật của auth-service — users-service
  // không giữ key nào cả (RS256, jwks-rsa fetch + cache public key).
  AUTH_JWKS_URI: Joi.string().uri().required(),
  // Chỉ auth-service (giữ private key) mới cần biến này — cấm luôn ở
  // đây để lỡ copy nhầm .env thì crash rõ ràng lúc khởi động thay vì
  // users-service âm thầm giữ luôn private key của auth-service.
  JWT_PRIVATE_KEY: Joi.any().forbidden(),
});
