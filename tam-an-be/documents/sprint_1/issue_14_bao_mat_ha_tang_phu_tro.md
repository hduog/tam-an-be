# Issue #14 — Bảo mật & Hạ tầng phụ trợ (Auth/Users): tổng kết

Tổng hợp trạng thái sau khi toàn bộ Sprint 1 (#01–#13, #15) đã merge.

## a) Token handling

- **Access token qua header `Authorization: Bearer`**: nhất quán trên mọi
  endpoint yêu cầu đăng nhập, qua `JwtAuthGuard` dùng chung (#09) —
  `passport-jwt` `ExtractJwt.fromAuthHeaderAsBearerToken()`.
- **Refresh token qua httpOnly cookie cho Web**: **chưa làm** — hiện BE
  luôn trả `refresh_token` trong response body (JSON) cho mọi client
  (Web lẫn Mobile), giống nhau. Đây là quyết định cần **FE/BE lead thống
  nhất** (đã ghi trong PR #22 — S1 #03): BE tự `Set-Cookie` hay FE tự set
  cookie từ response body. Không tự ý đổi vì ảnh hưởng trực tiếp đến FE.

## b) Rate limiting

- ✅ Áp dụng cho cả `POST /auth/login` (S1 #03) và `POST /auth/register`
  (bổ sung ở #14) — 5 request / IP / 60s mỗi endpoint, tracker độc lập
  theo route (`@nestjs/throttler`). Integration test xác nhận request
  thứ 6 → 429 cho cả 2 endpoint.

## c) Email service

- **Chưa tích hợp provider thật** (SES/SendGrid/...) — `ConsoleMailerService`
  (S1 #07) log nội dung email ra console thay vì gửi thật. Swap sang
  provider thật chỉ cần đổi provider trong `AuthModule` (`{ provide: MAILER,
  useClass: ... }`), `AuthService` không cần sửa.
- **DNS/SPF/DKIM**: việc hạ tầng/ops, ngoài phạm vi code — cần team
  infra/DevOps thực hiện trước khi bật provider thật.
- **Biến môi trường cần có khi bật provider thật**: tuỳ provider chọn
  (ví dụ `AWS_SES_*` hoặc `SENDGRID_API_KEY`), `FE_BASE_URL` (đã có,
  optional — dùng build link xác thực email).

## d) Testing

Tính đến khi #14 merge — `npm run test:cov`:

| Module | % Statements | % Branch | % Functions | % Lines |
|---|---|---|---|---|
| `src/auth/**` (trừ `auth.module.ts`, cấu hình DI thuần) | ~87–100% | ~81–91% | ~83–100% | ~87–100% |
| `src/users/**` (trừ `users.module.ts`) | ~85–100% | ~84–100% | ~60–100% | ~86–100% |

Dự án chưa cấu hình `coverageThreshold` trong Jest — không có ngưỡng số
cứng để đối chiếu pass/fail; số liệu trên phản ánh trạng thái thực tế.
`*.module.ts` (0% — thuần khai báo DI, không có logic) và
migrations/seed script không tính vào phạm vi unit test theo quy ước dự
án.

## e) Documentation

- ✅ Toàn bộ endpoint mới của AuthModule (#02, #03, #04, #05, #06, #07,
  #08, #09) và UsersModule (#11, #12, #13) đã có Swagger decorator
  (`@ApiTags`/`@ApiOperation`/`@ApiResponse`, `@ApiBearerAuth('access-token')`
  cho endpoint cần token).
- Guide riêng: [`auth-guard-guide.md`](../auth-guard-guide.md),
  [`error-response-guide.md`](../error-response-guide.md).

## Các điểm còn để ngỏ, cần input từ team/PO/infra (không phải thiếu sót do code)

| # | Điểm | Cần ai quyết định |
|---|---|---|
| 1 | httpOnly cookie cho refresh token (Web) | FE/BE lead |
| 2 | Chọn provider email thật (SES/SendGrid/...) + DNS/SPF/DKIM | DevOps/Infra |
| 3 | `GOOGLE_CLIENT_ID`/`APPLE_CLIENT_ID` thật (social login #04 mới hoạt động end-to-end) | BE lead + Apple/Google Developer account |
| 4 | Auto-link tài khoản social trùng email local (hiện đang từ chối — #04) | PO |
| 5 | Xác thực lại mật khẩu trước khi xoá tài khoản (#13) | PO |
