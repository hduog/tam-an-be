import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { EmailVerificationTokenService } from './email-verification-token.service';

describe('EmailVerificationTokenService', () => {
  const SECRET = 'test-secret-of-at-least-32-characters!!';
  const buildService = () =>
    new EmailVerificationTokenService(
      new ConfigService({ JWT_ACCESS_SECRET: SECRET }),
    );

  it('sign() rồi verifyAndGetUserId() trả đúng lại userId', () => {
    const service = buildService();
    const token = service.sign('user-id-1');

    expect(service.verifyAndGetUserId(token)).toBe('user-id-1');
  });

  it('token hết hạn: ném 401', () => {
    const service = buildService();
    const expiredToken = jwt.sign(
      { sub: 'user-id-1', purpose: 'email_verification' },
      SECRET,
      { expiresIn: '-1s' },
    );

    expect(() => service.verifyAndGetUserId(expiredToken)).toThrow(
      UnauthorizedException,
    );
  });

  it('token sai chữ ký: ném 401', () => {
    const service = buildService();
    const foreignToken = jwt.sign(
      { sub: 'user-id-1', purpose: 'email_verification' },
      'a-completely-different-secret',
    );

    expect(() => service.verifyAndGetUserId(foreignToken)).toThrow(
      UnauthorizedException,
    );
  });

  it('token hợp lệ nhưng sai "purpose" (vd tái dùng access token): ném 401', () => {
    const service = buildService();
    const wrongPurposeToken = jwt.sign(
      { sub: 'user-id-1', purpose: 'access_token' },
      SECRET,
    );

    expect(() => service.verifyAndGetUserId(wrongPurposeToken)).toThrow(
      UnauthorizedException,
    );
  });
});
