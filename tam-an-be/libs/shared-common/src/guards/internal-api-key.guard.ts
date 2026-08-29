import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { timingSafeEqual } from 'crypto';

const HEADER_NAME = 'x-internal-api-key';

/**
 * Bảo vệ route service-to-service (VD: POST/DELETE /internal/users) bằng
 * shared secret qua header — không dùng JWT user-facing, quá nặng cho
 * xác thực nội bộ giữa 2 service ở giai đoạn này.
 */
@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.headers[HEADER_NAME];
    const expected = this.configService.getOrThrow<string>('INTERNAL_API_KEY');

    if (typeof provided !== 'string' || !this.matches(provided, expected)) {
      throw new UnauthorizedException('Invalid internal API key');
    }
    return true;
  }

  private matches(provided: string, expected: string): boolean {
    const providedBuf = Buffer.from(provided);
    const expectedBuf = Buffer.from(expected);
    // Độ dài khác nhau -> timingSafeEqual throw thay vì trả false, nên
    // check độ dài trước (không rò rỉ thêm thông tin gì ngoài việc "sai").
    if (providedBuf.length !== expectedBuf.length) {
      return false;
    }
    return timingSafeEqual(providedBuf, expectedBuf);
  }
}
