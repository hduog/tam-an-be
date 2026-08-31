<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) monorepo — kiến trúc microservice:
`auth-service` (identity, DB riêng `auth_db`) và `users-service` (hồ sơ
người dùng, DB riêng `users_db`), chia sẻ code qua `libs/shared-auth`
(JWT guard/strategy) và `libs/shared-common` (error response filter).

## Project setup

```bash
$ npm install
$ docker compose up -d   # auth-postgres (5433) + users-postgres (5434)
```

### Environment setup

Mỗi service có `.env` riêng (KHÔNG dùng chung 1 file gộp cả 2):

```bash
$ cp apps/auth-service/.env.example apps/auth-service/.env
$ cp apps/users-service/.env.example apps/users-service/.env
```

Điền giá trị thật vào cả 2 file — quan trọng nhất:
- `apps/auth-service/.env`: `JWT_PRIVATE_KEY` (sinh bằng `npm run generate:jwt-keypair`, xem mục "Xác thực" bên dưới).
- `INTERNAL_API_KEY` **phải giống hệt nhau** ở cả 2 file (secret dùng cho gọi HTTP nội bộ auth-service → users-service).

## Compile and run the project

```bash
# development (mỗi service 1 process riêng)
$ npm run start:auth:dev
$ npm run start:users:dev

# production mode
$ npm run build
$ npm run start:prod:auth
$ npm run start:prod:users
```

## Migration

```bash
$ npm run migration:run:auth
$ npm run migration:run:users
```

## Run tests

```bash
# unit tests (cả 2 app + libs)
$ npm run test

# e2e tests (từng app, cần DB đang chạy)
$ npm run test:e2e:auth
$ npm run test:e2e:users

# test coverage
$ npm run test:cov
```

## API docs (Swagger)

- Swagger UI: `http://localhost:<PORT>/api/docs` (chỉ bật khi `NODE_ENV` khác `production`).
- Hướng dẫn thêm docs cho endpoint mới, test Bearer token trên UI: xem [documents/swagger-guide.md](documents/swagger-guide.md).

## Format response lỗi

- Toàn bộ lỗi trả về theo 1 format chuẩn (`statusCode`, `errorCode`, `message`, `path`, `timestamp`), áp dụng global — không cần cấu hình gì thêm ở controller mới. Chi tiết: xem [documents/error-response-guide.md](documents/error-response-guide.md).

## Xác thực (JWT Guard, RSA + JWKS)

- Access token ký RS256 bằng RSA private key — auth-service giữ
  `JWT_PRIVATE_KEY` (sinh bằng `npm run generate:jwt-keypair`), expose
  public key qua `GET /auth/jwks.json`. Các service khác (users-service)
  verify cục bộ qua `AUTH_JWKS_URI` trỏ tới endpoint đó — không giữ key
  nào cả. `JWT_ACCESS_SECRET` vẫn còn nhưng chỉ dùng riêng cho email
  verification token (nội bộ auth-service), không liên quan access token.
- Gọi HTTP nội bộ giữa 2 service (VD tạo/xoá hồ sơ khi đăng ký/xoá tài
  khoản) xác thực bằng `INTERNAL_API_KEY` — cùng 1 giá trị ở cả 2 `.env`.
- Hướng dẫn dùng `JwtAuthGuard`, `RolesGuard`, `@CurrentUser()`, `InternalApiKeyGuard`, phân biệt 401/403, cách thêm JWT verify cho service mới: xem [documents/auth-guard-guide.md](documents/auth-guard-guide.md).
- Sprint 1 (Auth/Users) — tổng kết bảo mật & hạ tầng phụ trợ, các điểm còn cần team/PO/infra quyết định: xem [documents/sprint_1/issue_14_bao_mat_ha_tang_phu_tro.md](documents/sprint_1/issue_14_bao_mat_ha_tang_phu_tro.md).

## Gửi email (SendGrid)

- Set `SENDGRID_API_KEY` + `SENDGRID_FROM_EMAIL` (email đã verify trên SendGrid — Single Sender hoặc Domain Authentication) để dùng SendGrid thật.
- **Thiếu 1 trong 2 biến trên** (mặc định ở local dev) → tự động fallback về `ConsoleMailerService`, chỉ log nội dung email ra console thay vì gửi thật — không cần API key để chạy dev/test.

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
