import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  DATABASE_HOST: Joi.string().required(),
  DATABASE_PORT: Joi.number().default(5432),
  DATABASE_USER: Joi.string().required(),
  DATABASE_PASSWORD: Joi.string().required(),
  DATABASE_NAME: Joi.string().required(),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  // Optional: chưa bắt buộc vì social login (#04) chỉ báo lỗi rõ ràng khi
  // gọi mà thiếu cấu hình, không chặn khởi động toàn bộ app.
  GOOGLE_CLIENT_ID: Joi.string().optional(),
  APPLE_CLIENT_ID: Joi.string().optional(),
  // Optional: dùng để build link xác thực email (#07) trỏ về FE. Chưa
  // chốt domain FE nên chưa required.
  FE_BASE_URL: Joi.string().uri().optional(),
  // Optional: chưa required vì local dev/test không cần API key SendGrid
  // thật — thiếu cả 2 -> AuthModule tự fallback ConsoleMailerService (#16).
  SENDGRID_API_KEY: Joi.string().optional(),
  SENDGRID_FROM_EMAIL: Joi.string().email().optional(),
});
