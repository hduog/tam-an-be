import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InternalApiKeyGuard } from './internal-api-key.guard';

describe('InternalApiKeyGuard', () => {
  const EXPECTED_KEY = 'x'.repeat(32);

  const buildContext = (headers: Record<string, string>): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
      }),
    }) as unknown as ExecutionContext;

  const buildGuard = (): InternalApiKeyGuard =>
    new InternalApiKeyGuard({
      getOrThrow: () => EXPECTED_KEY,
    } as unknown as ConfigService);

  it('đúng key: cho qua', () => {
    const guard = buildGuard();
    const context = buildContext({ 'x-internal-api-key': EXPECTED_KEY });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('thiếu header: ném UnauthorizedException', () => {
    const guard = buildGuard();
    const context = buildContext({});

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('sai key: ném UnauthorizedException', () => {
    const guard = buildGuard();
    const context = buildContext({ 'x-internal-api-key': 'wrong-key' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('key đúng độ dài nhưng sai nội dung: vẫn ném UnauthorizedException', () => {
    const guard = buildGuard();
    const context = buildContext({ 'x-internal-api-key': 'y'.repeat(32) });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
