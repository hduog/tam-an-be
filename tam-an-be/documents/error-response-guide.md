# Hướng dẫn format response lỗi trong tam-an-be

Baseline error format của dự án (Issue #10) — áp dụng **toàn bộ API**, không
riêng AuthModule. Được đăng ký global qua `AllExceptionsFilter` trong
`main.ts`, không cần làm gì thêm ở controller/service để có được format này.

## Format chuẩn

```json
{
  "statusCode": 401,
  "errorCode": "UNAUTHORIZED",
  "message": "Invalid token",
  "path": "/auth/me",
  "timestamp": "2026-08-29T04:40:00.000Z"
}
```

- `errorCode` suy ra tự động từ tên class exception (vd. `UnauthorizedException`
  → `UNAUTHORIZED`, `NotFoundException` → `NOT_FOUND`). Muốn có `errorCode`
  cụ thể, chỉ cần `throw` đúng loại `HttpException` tương ứng — không cần
  khai báo gì thêm.
- `message` có thể là `string` hoặc `string[]` (giữ nguyên mảng lỗi từ
  `ValidationPipe`/`class-validator`, không gộp thành 1 chuỗi).

## 401 vs 403
- **401** — chưa xác thực (thiếu/sai/hết hạn token). Guard chung (`JwtAuthGuard`,
  Issue #09) tự ném, không cần code thêm.
- **403** — đã xác thực nhưng không đủ quyền (sai role, không phải chủ sở hữu
  resource). Ném `ForbiddenException` trong `RolesGuard` hoặc thủ công trong
  service/controller khi check Owner.

## Không rò rỉ thông tin nhạy cảm
- Lỗi không phải `HttpException` (bug, lỗi DB, ...) luôn trả về message chung
  `"Internal server error"` — **không** bao giờ lộ `error.message`/stack trace
  gốc ra response.
- Muốn tránh lộ chi tiết cụ thể (vd. "không tiết lộ email có tồn tại hay
  không khi login sai") thì tự kiểm soát `message` khi `throw` — filter chỉ
  đóng gói lại đúng nguyên message bạn truyền vào, không tự thêm chi tiết.

## Logging
- 401/403 → log ở mức `warn` (phục vụ giám sát bảo mật).
- Lỗi 5xx → log ở mức `error` kèm stack trace (phía server, không trả về
  client).
- Không log token, password, hay bất kỳ header/body request nào — filter chỉ
  log `method + path + status + message`.
