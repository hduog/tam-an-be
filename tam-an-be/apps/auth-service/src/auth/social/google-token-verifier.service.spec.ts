import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { GoogleTokenVerifierService } from './google-token-verifier.service';

describe('GoogleTokenVerifierService', () => {
  const buildService = (googleClientId: string | undefined) => {
    const config = new ConfigService({ GOOGLE_CLIENT_ID: googleClientId });
    return new GoogleTokenVerifierService(config);
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('ném 401 nếu GOOGLE_CLIENT_ID chưa được cấu hình — không gọi verifyIdToken', async () => {
    const service = buildService(undefined);
    const spy = jest.spyOn(OAuth2Client.prototype, 'verifyIdToken');

    await expect(service.verify('some-token')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it('token hợp lệ: trả về providerId (sub), email, displayName (name)', async () => {
    const service = buildService('test-client-id');
    jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
      getPayload: () => ({
        sub: 'google-sub-123',
        email: 'user@gmail.com',
        name: 'Nguyễn Văn A',
      }),
    } as never);

    const result = await service.verify('valid-token');

    expect(result).toEqual({
      providerId: 'google-sub-123',
      email: 'user@gmail.com',
      displayName: 'Nguyễn Văn A',
    });
  });

  it('token hết hạn/invalid (verifyIdToken throw): ném 401', async () => {
    const service = buildService('test-client-id');
    jest
      .spyOn(OAuth2Client.prototype, 'verifyIdToken')
      .mockRejectedValue(new Error('Token used too late'));

    await expect(service.verify('expired-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('payload thiếu sub hoặc email: ném 401', async () => {
    const service = buildService('test-client-id');
    jest.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({
      getPayload: () => ({ sub: 'google-sub-123' }), // thiếu email
    } as never);

    await expect(service.verify('token-without-email')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
