import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';
import { SendGridMailerService } from './sendgrid-mailer.service';

jest.mock('@sendgrid/mail', () => ({
  __esModule: true,
  default: {
    setApiKey: jest.fn(),
    send: jest.fn(),
  },
}));

// Cast toàn bộ object sang kiểu property-of-function-type (không phải
// method this-typed gốc của @sendgrid/mail) trước khi lấy ra từng mock,
// để tránh cảnh báo @typescript-eslint/unbound-method khi tham chiếu như
// 1 mock độc lập trong expect().
const sgMailMocks = sgMail as unknown as {
  setApiKey: jest.Mock;
  send: jest.Mock;
};
const setApiKeyMock = sgMailMocks.setApiKey;
const sendMock = sgMailMocks.send;

describe('SendGridMailerService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  const buildService = (env: Record<string, string | undefined>) =>
    new SendGridMailerService(new ConfigService(env));

  it('constructor: setApiKey ngay khi có SENDGRID_API_KEY', () => {
    buildService({ SENDGRID_API_KEY: 'SG.fake-key' });

    expect(setApiKeyMock).toHaveBeenCalledWith('SG.fake-key');
  });

  it('constructor: không gọi setApiKey khi thiếu SENDGRID_API_KEY', () => {
    buildService({});

    expect(setApiKeyMock).not.toHaveBeenCalled();
  });

  it('gửi thành công: gọi sgMail.send với đúng to/from/subject/text', async () => {
    const service = buildService({
      SENDGRID_API_KEY: 'SG.fake-key',
      SENDGRID_FROM_EMAIL: 'no-reply@tam-an.dev',
    });
    sendMock.mockResolvedValue([]);

    await service.send({
      to: 'user@tam-an.dev',
      subject: 'Xác thực email',
      text: 'nội dung',
    });

    expect(sendMock).toHaveBeenCalledWith({
      to: 'user@tam-an.dev',
      from: 'no-reply@tam-an.dev',
      subject: 'Xác thực email',
      text: 'nội dung',
    });
  });

  it('thiếu SENDGRID_API_KEY hoặc SENDGRID_FROM_EMAIL: ném lỗi rõ ràng, không gọi sgMail.send', async () => {
    const service = buildService({ SENDGRID_API_KEY: 'SG.fake-key' }); // thiếu FROM_EMAIL

    await expect(
      service.send({ to: 'a@b.com', subject: 's', text: 't' }),
    ).rejects.toThrow(/chưa được cấu hình/);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('SendGrid trả lỗi (vd invalid API key/rate limit): ném lỗi chung, không lộ chi tiết lỗi gốc', async () => {
    const service = buildService({
      SENDGRID_API_KEY: 'SG.fake-key',
      SENDGRID_FROM_EMAIL: 'no-reply@tam-an.dev',
    });
    sendMock.mockRejectedValue(
      new Error('Unauthorized: invalid API key XYZ-SECRET-123'),
    );

    await expect(
      service.send({ to: 'a@b.com', subject: 's', text: 't' }),
    ).rejects.toThrow('Gửi email thất bại, vui lòng thử lại sau');
  });
});
