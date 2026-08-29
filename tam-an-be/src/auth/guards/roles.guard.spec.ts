import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { UserRole } from '../../users/user.entity';

describe('RolesGuard', () => {
  let reflector: Reflector;
  let guard: RolesGuard;

  const buildContext = (user?: { id: string; role: UserRole }) =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('cho qua khi endpoint không yêu cầu role cụ thể', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    expect(guard.canActivate(buildContext())).toBe(true);
  });

  it('cho qua khi role của user khớp với role yêu cầu', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.ADMIN]);

    expect(
      guard.canActivate(buildContext({ id: 'u1', role: UserRole.ADMIN })),
    ).toBe(true);
  });

  it('ném 403 khi role của user không khớp (đã đăng nhập nhưng không đủ quyền)', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.ADMIN]);

    expect(() =>
      guard.canActivate(buildContext({ id: 'u1', role: UserRole.USER })),
    ).toThrow(ForbiddenException);
  });

  it('ném 403 khi endpoint yêu cầu role nhưng request không có user', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.ADMIN]);

    expect(() => guard.canActivate(buildContext(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
