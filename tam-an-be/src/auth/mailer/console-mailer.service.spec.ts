import { Logger } from '@nestjs/common';
import { ConsoleMailerService } from './console-mailer.service';

describe('ConsoleMailerService', () => {
  it('log lại nội dung email và resolve (không throw) — dùng khi chưa có provider thật', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const service = new ConsoleMailerService();

    await expect(
      service.send({
        to: 'user@tam-an.dev',
        subject: 'Xác thực email',
        text: 'link xác thực ở đây',
      }),
    ).resolves.toBeUndefined();

    expect(logSpy).toHaveBeenCalledTimes(1);
    const loggedMessage = logSpy.mock.calls[0][0] as string;
    expect(loggedMessage).toContain('user@tam-an.dev');
    expect(loggedMessage).toContain('Xác thực email');

    logSpy.mockRestore();
  });
});
