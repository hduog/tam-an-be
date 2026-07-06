# Hướng dẫn dùng Swagger/OpenAPI trong tam-an-be

## Truy cập Swagger UI
- Chạy app ở môi trường không phải `production` (`NODE_ENV=development` hoặc `test`).
- Mở `http://localhost:<PORT>/api/docs`.
- Ở `NODE_ENV=production`, route Swagger UI **không được đăng ký** (không tồn tại), tránh lộ tài liệu API ra ngoài.

## Test API cần Bearer Token (JWT) trên Swagger UI
1. Bấm nút **Authorize** ở góc trên bên phải Swagger UI.
2. Dán access token (không cần tiền tố `Bearer `, Swagger tự thêm).
3. Các endpoint có decorator `@ApiBearerAuth('access-token')` sẽ tự động gắn header
   `Authorization: Bearer <token>` khi gọi thử trên UI.

## Thêm Swagger docs cho endpoint mới
Dự án đã bật plugin `@nestjs/swagger` trong `nest-cli.json`, plugin này tự đọc
type + decorator `class-validator` trên DTO để suy ra `@ApiProperty` — hầu hết
trường hợp bạn **không cần** tự viết `@ApiProperty` cho từng field.

Việc cần làm cho controller/DTO mới:

```ts
@ApiTags('Users') // gắn 1 lần trên class Controller, đúng tên module
@Controller('users')
export class UsersController {
  @ApiOperation({ summary: 'Lấy thông tin user theo username' })
  @ApiResponse({ status: 200, description: 'Thành công', type: UserResponseDto })
  @ApiResponse({ status: 404, description: 'Không tìm thấy user' })
  @Get(':username')
  getByUsername(@Param('username') username: string) {
    /* ... */
  }

  @ApiBearerAuth('access-token') // chỉ thêm cho endpoint cần access token
  @ApiOperation({ summary: 'Cập nhật thông tin user hiện tại' })
  @Patch('me')
  updateMe() {
    /* ... */
  }
}
```

Ghi chú:
- `@ApiTags('<Module>')` đặt 1 lần trên class Controller, trùng tên module (`Auth`, `Users`, …) — các tag này đã được khai báo sẵn trong `main.ts`.
- `@ApiBearerAuth('access-token')` chỉ cần cho các endpoint yêu cầu access token — tên security scheme (`access-token`) phải khớp với tên đã đăng ký trong `DocumentBuilder.addBearerAuth()` ở `main.ts`.
- Nếu DTO cần mô tả/ví dụ rõ hơn giá trị mặc định do plugin suy luận, thêm `@ApiProperty({ description, example })` thủ công trên field đó.

## Chính sách bảo mật docs ở production
Hiện tại route `/api/docs` bị tắt hoàn toàn khi `NODE_ENV=production` (điều kiện
`process.env.NODE_ENV !== 'production'` trong `main.ts`). Nếu team cần một môi
trường "staging" hiển thị Swagger UI nhưng có bảo vệ (ví dụ Basic Auth), đây là
điểm cần thống nhất thêm với PO/DevOps trước khi triển khai lên môi trường đó.
