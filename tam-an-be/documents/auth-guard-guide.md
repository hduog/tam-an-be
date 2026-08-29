# Hướng dẫn dùng JWT Guard/Decorator trong tam-an-be

Hạ tầng xác thực dùng chung (Issue #09), dùng lại cho mọi module cần đăng
nhập ở các sprint sau — không chỉ AuthModule/UsersModule.

## 3 tầng truy cập

| Tầng | Cách áp dụng |
|---|---|
| **Guest** | Không thêm gì cả — mặc định mọi route không có `@UseGuards(JwtAuthGuard)` đều là Guest. |
| **User** | `@UseGuards(JwtAuthGuard)` trên method hoặc class. Cần token hợp lệ, không quan tâm role/quyền sở hữu. |
| **Owner** | `@UseGuards(JwtAuthGuard)` + so sánh thủ công `req.user.id` với id của resource trong service/controller (xem ví dụ bên dưới). Không có "OwnerGuard" chung vì việc xác định "ai là chủ resource" khác nhau theo từng entity. |

Cần giới hạn theo **role** (vd. chỉ `admin`) thì thêm `RolesGuard` +
`@Roles(...)`:

```ts
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Get('admin-only')
adminOnly() { /* ... */ }
```

`RolesGuard` luôn phải đứng **sau** `JwtAuthGuard` trong `@UseGuards(...)` vì
nó đọc `req.user` do `JwtAuthGuard` gắn vào.

## Ví dụ đầy đủ (User + Owner)

```ts
@Controller('users')
export class UsersController {
  // User tier — bất kỳ ai đã đăng nhập
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findById(user.id);
  }

  // Owner tier — đã đăng nhập + đúng là chủ tài khoản
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    // route /users/me tự ngầm định "me" = user.id, không cần so sánh thêm.
    // Với route có :id tường minh (vd /posts/:id), so sánh:
    //   if (post.ownerId !== user.id) throw new ForbiddenException();
    return this.usersService.update(user.id, dto);
  }
}
```

## 401 vs 403
- **401 Unauthorized** — thiếu token, token sai chữ ký, hoặc hết hạn. Do
  `JwtAuthGuard` xử lý (qua `handleRequest`), không cần tự throw tay.
- **403 Forbidden** — đã đăng nhập hợp lệ nhưng không đủ quyền (sai role,
  hoặc không phải chủ resource). Do `RolesGuard` xử lý cho role, hoặc tự
  `throw new ForbiddenException()` trong service/controller cho Owner check.

Response 401/403 trả về theo format lỗi chuẩn chung của cả API (Issue #10) —
xem [documents/error-response-guide.md](error-response-guide.md).

## Lấy thông tin user hiện tại
Dùng decorator `@CurrentUser()` thay vì đọc `req.user` trực tiếp:

```ts
@Get('me')
@UseGuards(JwtAuthGuard)
getMe(@CurrentUser() user: AuthenticatedUser) {
  // user: { id: string; role: UserRole }
}
```

Payload JWT chỉ chứa `sub` (user id) và `role` — cố tình tối giản để token
nhẹ. Cần thêm thông tin khác (email, display_name...) thì query DB trong
service bằng `user.id`, không nhét thêm vào token.

## Sinh & xác thực token
`AuthModule` export `JwtModule` (đã cấu hình sẵn secret/thời hạn từ env) —
import `AuthModule` vào module cần tự sinh token (vd. Issue #03 login,
Issue #05 refresh) và inject `JwtService` để `sign()`/`verify()`.

Biến môi trường cần có:
- `JWT_ACCESS_SECRET` — bắt buộc, tối thiểu 32 ký tự.
- `JWT_ACCESS_EXPIRES_IN` — tuỳ chọn, mặc định `15m`.

## `@Public()` — dùng khi nào?
`JwtAuthGuard` hiện áp dụng theo từng route qua `@UseGuards(...)`, **chưa**
đăng ký global (`APP_GUARD`). Decorator `@Public()` đã dựng sẵn để dùng khi
guard được chuyển sang global ở sprint sau (bảo vệ mặc định, chỉ định
route Guest tường minh) — hiện tại không cần gắn `@Public()` cho endpoint
Guest, chỉ cần không thêm `@UseGuards(JwtAuthGuard)`.
