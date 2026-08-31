# Hướng dẫn dùng JWT Guard/Decorator trong tam-an-be

Hạ tầng xác thực dùng chung, sống trong `libs/shared-auth` — dùng được ở
**mọi service** trong monorepo (`auth-service`, `users-service`, và bất kỳ
service nào thêm sau này), không chỉ auth-service. Lib này **không đụng
DB, không phụ thuộc entity** — chỉ tin vào claim `sub`/`role` trong JWT,
nên an toàn để import ở bất kỳ đâu.

> Repo này là kiến trúc microservice: `auth-service` giữ RSA private key
> và ký token; các service khác (bắt đầu từ `users-service`) chỉ verify
> token, không giữ key nào cả. Xem [RSA/JWKS](#sinh--xác-thực-token-rsa--jwks)
> bên dưới trước khi thêm 1 endpoint cần đăng nhập ở service mới.

## Import

Mọi guard/decorator/interface dùng chung import từ `@shared-auth` (alias
tới `libs/shared-auth/src`), không phải đường dẫn tương đối:

```ts
import { CurrentUser, JwtAuthGuard, RolesGuard, Roles } from '@shared-auth';
import type { AuthenticatedUser } from '@shared-auth';
```

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

## Ví dụ đầy đủ (User + Owner) — nguyên bản từ `users-service`

```ts
// apps/users-service/src/profiles/profiles.controller.ts
@Controller('users')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  // User + Owner tier — route /users/me tự ngầm định "me" = user.id,
  // không cần so sánh thêm. Với route có :id tường minh (vd /posts/:id),
  // so sánh thủ công: if (post.ownerId !== user.id) throw new ForbiddenException();
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profilesService.updateProfile(user.id, dto);
  }

  // Guest tier — không có @UseGuards nào cả.
  @Get(':username')
  getPublicProfile(@Param('username') username: string) {
    return this.profilesService.getPublicProfileByUsername(username);
  }
}
```

## 401 vs 403
- **401 Unauthorized** — thiếu token, token sai chữ ký, hoặc hết hạn. Do
  `JwtAuthGuard` xử lý (qua `handleRequest`), không cần tự throw tay.
- **403 Forbidden** — đã đăng nhập hợp lệ nhưng không đủ quyền (sai role,
  hoặc không phải chủ resource). Do `RolesGuard` xử lý cho role, hoặc tự
  `throw new ForbiddenException()` trong service/controller cho Owner check.

Response 401/403 trả về theo format lỗi chuẩn chung của cả API — xem
[documents/error-response-guide.md](error-response-guide.md).

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
nhẹ, và vì mỗi service verify token **cục bộ** (không gọi mạng mỗi request),
token không thể chứa dữ liệu chỉ auth-service mới biết là còn mới nhất
(display_name, v.v.). Cần thông tin khác thì query DB của chính service đó
bằng `user.id` (VD `users-service` tự tra `user_profiles`), không nhét
thêm vào token, và không gọi sang auth-service trên hot path.

## Sinh & xác thực token (RSA + JWKS)

Access token ký **RS256** bằng RSA keypair, không còn dùng HMAC secret
dùng chung giữa các service. `JwtStrategy` (trong `libs/shared-auth`) tự
chọn 1 trong 2 chế độ verify dựa trên biến env nào có mặt — **service
nào cũng dùng đúng 1 dòng code `JwtAuthGuard`/`@shared-auth` như nhau,
chỉ khác cấu hình**:

| Chế độ | Khi nào | Biến env |
|---|---|---|
| **Local key** | Chỉ `auth-service` — service duy nhất giữ private key, verify ngay trong process, không tự gọi HTTP tới JWKS của chính mình. | `JWT_PRIVATE_KEY` (PEM) |
| **JWKS remote** | Mọi service khác (`users-service`, service mới thêm sau này) — không giữ key nào, fetch + cache public key từ `GET /auth/jwks.json` của auth-service. | `AUTH_JWKS_URI` (VD `http://localhost:3001/auth/jwks.json`) |

Mỗi service khai báo `Joi.any().forbidden()` cho biến của phía kia trong
`env.validation.ts` — lỡ copy nhầm `.env` sẽ crash rõ ràng lúc khởi động
thay vì âm thầm verify sai chế độ (nguy hiểm nhất nếu 1 service không nên
giữ private key lại vô tình có).

**Thêm JWT verify cho 1 service mới (không phải auth-service):**
1. Import `SharedAuthModule` vào module cần dùng guard (xem
   `apps/users-service/src/profiles/profiles.module.ts` làm ví dụ) —
   không cần cấu hình gì thêm, `JwtStrategy` tự đọc `AUTH_JWKS_URI`.
2. Thêm `AUTH_JWKS_URI` (required) + `JWT_PRIVATE_KEY: Joi.any().forbidden()`
   vào `env.validation.ts` của service đó.
3. Dùng `@UseGuards(JwtAuthGuard)` như bình thường — không cần biết gì
   thêm về RSA/JWKS ở tầng controller.

**auth-service tự ký token** (`apps/auth-service/src/auth/auth.module.ts`,
`token.service.ts`) — không cần đụng vào nếu chỉ thêm route mới ở
auth-service, `TokenService.issueTokenPair()` đã lo phần này. Sinh
keypair mới (dev/rotate): `npm run generate:jwt-keypair`, paste
`JWT_PRIVATE_KEY` in ra vào `.env`.

**Rotate key**: `jwks-rsa` cache public key phía các service verify-remote
(mặc định ~10h) — đổi `JWT_PRIVATE_KEY`/`JWT_KEY_ID` đột ngột mà không
phục vụ song song cả key cũ lẫn mới ở `GET /auth/jwks.json` sẽ khiến
token cũ (ký bằng key cũ) bị fail verify tới hết cache window bên các
service khác. Hiện tại `GET /auth/jwks.json` trả về mảng `keys: [...]`
đúng chuẩn JWKS để hỗ trợ nhiều key cùng lúc, nhưng cơ chế "phục vụ 2 key
song song khi rotate" chưa được xây — cần làm trước khi rotate key thật
trên production.

## Internal API key guard — endpoint service-to-service (KHÔNG phải JWT)

Endpoint chỉ để 1 service khác trong hệ thống gọi (VD
`POST /internal/users` bên `users-service`, do `auth-service` gọi lúc
đăng ký/xoá tài khoản) **không dùng `JwtAuthGuard`** — không có JWT user
nào ở đây, đây là service-to-service. Dùng `InternalApiKeyGuard` (từ
`libs/shared-common`, `@shared-common`) — so sánh header
`X-Internal-Api-Key` với `INTERNAL_API_KEY` (`crypto.timingSafeEqual`,
cả 2 service cùng khai báo, giá trị **phải giống hệt nhau**):

```ts
// apps/users-service/src/profiles/internal-users.controller.ts
@Controller('internal/users')
@UseGuards(InternalApiKeyGuard)
export class InternalUsersController {
  @Post()
  create(@Body() dto: CreateProfileDto) { /* ... */ }

  @Delete(':userId')
  delete(@Param('userId', ParseUUIDPipe) userId: string) { /* ... */ }
}
```

Không trộn 2 loại guard trên cùng 1 route — 1 route hoặc dành cho end-user
(`JwtAuthGuard`) hoặc dành cho service khác (`InternalApiKeyGuard`),
không cả hai.

## `@Public()` — dùng khi nào?
`JwtAuthGuard` hiện áp dụng theo từng route qua `@UseGuards(...)`, **chưa**
đăng ký global (`APP_GUARD`) ở service nào. Decorator `@Public()` đã dựng
sẵn để dùng khi 1 service chuyển guard sang global (bảo vệ mặc định, chỉ
định route Guest tường minh) — hiện tại không cần gắn `@Public()` cho
endpoint Guest, chỉ cần không thêm `@UseGuards(JwtAuthGuard)`.
