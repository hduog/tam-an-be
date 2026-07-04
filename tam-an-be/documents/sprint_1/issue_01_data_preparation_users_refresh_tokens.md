# Issue #01 — Chuẩn bị dữ liệu (Users & Refresh Tokens)

| Field | Value |
|---|---|
| **Type** | Task (Backend) |
| **Sprint** | S1 — Xác thực & Tài khoản |
| **Priority** | P0 (Must have) |
| **Module** | AuthModule / UsersModule |
| **Component** | Database — PostgreSQL |
| **Estimate** | 3 SP |
| **Labels** | `backend`, `database`, `migration`, `sprint-1` |
| **Depends on** | S0 — base migrations, DB connection đã setup |
| **Blocks** | Toàn bộ endpoint của AuthModule & UsersModule (Issue tiếp theo) |

## Mô tả
Chuẩn bị toàn bộ nền tảng dữ liệu cho tính năng Xác thực & Tài khoản: tạo enum, migration bảng `users` (hub chính) và `refresh_tokens`, đánh index, và seed dữ liệu test cho QA/FE sử dụng trong quá trình phát triển.

## Ngữ cảnh / Tài liệu tham chiếu
Theo tài liệu Database & API Design: `users` là bảng hub trung tâm, dùng chung cho người dùng thường, chuyên gia và admin. `refresh_tokens` phục vụ cơ chế JWT rotating (access ~15 phút, refresh ~30 ngày).

## Acceptance Criteria

### a) Enum PostgreSQL
- [ ] Tạo enum `user_role`: `user` · `expert` · `admin`
- [ ] Tạo enum `user_status`: `active` · `suspended` · `deleted`
- [ ] Tạo enum `auth_provider`: `local` · `google` · `apple`

### b) Migration bảng `users`
- [ ] Tạo bảng `users` với đầy đủ cột:

| Cột | Kiểu | Ràng buộc | Mô tả |
|---|---|---|---|
| `id` | uuid | PK, default `gen_random_uuid()` | Định danh tài khoản |
| `email` | varchar(255) | UNIQUE, NOT NULL | Email đăng nhập |
| `password_hash` | varchar(255) | NULL | Argon2/bcrypt; NULL nếu chỉ đăng nhập social |
| `role` | user_role | NOT NULL, default `'user'` | user / expert / admin |
| `display_name` | varchar(120) | NOT NULL | Tên hiển thị |
| `username` | varchar(60) | UNIQUE | Handle cho URL `/@username` |
| `avatar_url` | text | NULL | Ảnh đại diện (media_assets) |
| `bio` | text | NULL | Giới thiệu ngắn |
| `provider` | auth_provider | default `'local'` | local / google / apple |
| `provider_id` | varchar(255) | NULL | ID từ nhà cung cấp social |
| `email_verified_at` | timestamptz | NULL | Thời điểm xác thực email |
| `status` | user_status | default `'active'` | active / suspended / deleted |
| `created_at`, `updated_at` | timestamptz | default `now()` | Dấu thời gian tạo/cập nhật |
| `deleted_at` | timestamptz | NULL | Soft delete |

### c) Migration bảng `refresh_tokens`
- [ ] Tạo bảng `refresh_tokens` với cột: `id (PK)`, `user_id (FK → users)`, `token_hash`, `device_info`, `expires_at`, `revoked_at`

### d) Index
- [ ] `uq(email)`, `uq(username)`, `idx(role)`, `idx(status)` trên bảng `users`
- [ ] `idx(user_id)`, `idx(token_hash)` trên bảng `refresh_tokens`

### e) Seed dữ liệu test
- [ ] Seed vài user mẫu (đủ role: user/expert/admin, đủ trạng thái email verified/chưa) để QA & FE dùng khi dev

## Technical Notes
- Thứ tự migration: tạo enum trước → bảng `users` → bảng `refresh_tokens` (do FK phụ thuộc).
- `password_hash` để nullable vì tài khoản social login sẽ không có mật khẩu local.
- Migration cần chạy được cả `up` và `down` (rollback an toàn), không phá vỡ dữ liệu đã có từ S0.

## Definition of Done
- [ ] Code review & merge vào nhánh chính
- [ ] Migration test rollback/up thành công trên dev & staging
- [ ] Seed script chạy được, dữ liệu mẫu đúng như mô tả
- [ ] Cập nhật tài liệu schema nếu có sai khác so với thiết kế gốc
