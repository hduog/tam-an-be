import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';
import { MailMessage, Mailer } from '../interfaces/mailer.interface';

@Injectable()
export class SendGridMailerService implements Mailer {
  private readonly logger = new Logger('Mailer(sendgrid)');

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
    // Constructor chỉ nên setup, không throw — thiếu API key chỉ chặn
    // đúng lúc gọi send() (module chỉ chọn SendGridMailerService khi đã
    // có SENDGRID_API_KEY — xem AuthModule — nhưng vẫn phòng thủ ở đây).
    if (apiKey) {
      sgMail.setApiKey(apiKey);
    }
  }

  async send(message: MailMessage): Promise<void> {
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
    const from = this.configService.get<string>('SENDGRID_FROM_EMAIL');
    if (!apiKey || !from) {
      throw new Error(
        'SendGrid chưa được cấu hình đầy đủ (thiếu SENDGRID_API_KEY hoặc SENDGRID_FROM_EMAIL)',
      );
    }

    try {
      await sgMail.send({
        to: message.to,
        from,
        subject: message.subject,
        text: message.text,
      });
    } catch (error) {
      // Không log/rethrow nguyên văn lỗi từ SendGrid (có thể chứa API key
      // trong header request bị echo lại) ra ngoài — chỉ log message ở
      // server, ném lỗi chung để AuthService/global filter xử lý thành
      // response an toàn cho client.
      this.logger.error(
        `Gửi email tới ${message.to} thất bại: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      throw new Error('Gửi email thất bại, vui lòng thử lại sau');
    }
  }
}
