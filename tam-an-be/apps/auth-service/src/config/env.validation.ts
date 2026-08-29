import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  AUTH_DB_HOST: Joi.string().required(),
  AUTH_DB_PORT: Joi.number().default(5432),
  AUTH_DB_USER: Joi.string().required(),
  AUTH_DB_PASSWORD: Joi.string().required(),
  AUTH_DB_NAME: Joi.string().required(),
  // Vẫn cần cho email-verification-token.service.ts — token xác thực
  // email chỉ ký/verify nội bộ trong auth-service, không xuyên service,
  // nên không cần chuyển sang RS256 cùng access token.
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  // RSA private key (PEM) dùng ký access token RS256 — chấp nhận cả PEM
  // có newline thật lẫn dạng \n escape (một số secrets manager làm mất
  // newline thật). Sinh bằng `npm run generate:jwt-keypair`.
  JWT_PRIVATE_KEY: Joi.string().required(),
  JWT_KEY_ID: Joi.string().default('auth-key-1'),
  // Chỉ service KHÔNG giữ private key mới cần biến này (users-service...)
  // — cấm luôn ở đây để lỡ copy nhầm .env thì crash rõ ràng lúc khởi
  // động thay vì JwtStrategy âm thầm chọn sai chế độ verify.
  AUTH_JWKS_URI: Joi.any().forbidden(),
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
