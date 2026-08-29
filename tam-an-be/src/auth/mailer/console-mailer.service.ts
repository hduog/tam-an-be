import { Injectable, Logger } from '@nestjs/common';
import { MailMessage, Mailer } from '../interfaces/mailer.interface';

/**
 * Chưa tích hợp dịch vụ gửi email thật (SES/SendGrid/...) — hạ tầng này
 * nằm trong scope Issue #14 (mục "Email service"), cần domain/DNS
 * (SPF/DKIM) chuẩn bị trước theo Technical Notes của #07. Implementation
 * này log lại nội dung email ra console thay vì gửi thật, để #07 verify
 * được toàn bộ luồng (sinh token, verify, resend) ngay bây giờ mà không
 * chặn vào việc chọn provider. Swap sang provider thật chỉ cần đổi
 * provider này trong AuthModule — AuthService không cần biết.
 */
@Injectable()
export class ConsoleMailerService implements Mailer {
  private readonly logger = new Logger('Mailer(console)');

  send(message: MailMessage): Promise<void> {
    this.logger.log(
      `TODO(#14): gửi email thật khi có provider — [DEV] To: ${message.to} | Subject: ${message.subject}\n${message.text}`,
    );
    return Promise.resolve();
  }
}
