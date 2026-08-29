import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { AppleTokenVerifierService } from './apple-token-verifier.service';

jest.mock('jsonwebtoken', () => ({
  decode: jest.fn(),
  verify: jest.fn(),
}));

const mockedJwt = jwt as jest.Mocked<typeof jwt>;

describe('AppleTokenVerifierService', () => {
  const buildService = (appleClientId: string | undefined) => {
    const config = new ConfigService({ APPLE_CLIENT_ID: appleClientId });
    return new AppleTokenVerifierService(config);
  };

  afterEach(() => {
    jest.restoreAllMocks();
    mockedJwt.decode.mockReset();
    mockedJwt.verify.mockReset();
  });

  it('ném 401 nếu APPLE_CLIENT_ID chưa được cấu hình — không decode/verify token', async () => {
    const service = buildService(undefined);

    await expect(service.verify('some-token')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(mockedJwt.decode).not.toHaveBeenCalled();
  });

  it('token không decode được / thiếu kid trong header: ném 401', async () => {
    const service = buildService('test-client-id');
    mockedJwt.decode.mockReturnValue(null);

    await expect(service.verify('malformed-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('không lấy được signing key từ JWKS (mạng lỗi/kid không tồn tại): ném 401', async () => {
    const service = buildService('test-client-id');
    mockedJwt.decode.mockReturnValue({
      header: { kid: 'unknown-kid', alg: 'RS256' },
      payload: {},
      signature: '',
    });
    jest
      .spyOn(service.jwks, 'getSigningKey')
      .mockRejectedValue(new Error('Unable to find a signing key'));

    await expect(service.verify('token-with-unknown-kid')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('token hết hạn/sai chữ ký (jwt.verify throw): ném 401', async () => {
    const service = buildService('test-client-id');
    mockedJwt.decode.mockReturnValue({
      header: { kid: 'valid-kid', alg: 'RS256' },
      payload: {},
      signature: '',
    });
    jest.spyOn(service.jwks, 'getSigningKey').mockResolvedValue({
      getPublicKey: () => 'fake-public-key',
    } as never);
    mockedJwt.verify.mockImplementation(() => {
      throw new Error('jwt expired');
    });

    await expect(service.verify('expired-token')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('token hợp lệ nhưng thiếu email (Apple không trả lại từ lần 2 trở đi): ném 401 rõ ràng', async () => {
    const service = buildService('test-client-id');
    mockedJwt.decode.mockReturnValue({
      header: { kid: 'valid-kid', alg: 'RS256' },
      payload: {},
      signature: '',
    });
    jest.spyOn(service.jwks, 'getSigningKey').mockResolvedValue({
      getPublicKey: () => 'fake-public-key',
    } as never);
    mockedJwt.verify.mockReturnValue({ sub: 'apple-sub-1' } as never);

    await expect(service.verify('valid-token-no-email')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('token hợp lệ đầy đủ: trả về providerId (sub) và email', async () => {
    const service = buildService('test-client-id');
    mockedJwt.decode.mockReturnValue({
      header: { kid: 'valid-kid', alg: 'RS256' },
      payload: {},
      signature: '',
    });
    jest.spyOn(service.jwks, 'getSigningKey').mockResolvedValue({
      getPublicKey: () => 'fake-public-key',
    } as never);
    mockedJwt.verify.mockReturnValue({
      sub: 'apple-sub-1',
      email: 'user@privaterelay.appleid.com',
    } as never);

    const result = await service.verify('valid-token');

    expect(result).toEqual({
      providerId: 'apple-sub-1',
      email: 'user@privaterelay.appleid.com',
    });
  });
});
