export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Cho phép swap sang provider thật (SES/SendGrid/...) sau này mà không
 * đụng vào AuthService. Khai báo dạng property (không phải method
 * shorthand) để tránh cảnh báo @typescript-eslint/unbound-method khi
 * test tham chiếu `mailer.send` như 1 jest mock độc lập.
 */
export interface Mailer {
  send: (message: MailMessage) => Promise<void>;
}
