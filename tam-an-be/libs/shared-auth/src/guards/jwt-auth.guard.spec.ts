import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './jwt-auth.guard';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

describe('JwtAuthGuard', () => {
  let reflector: Reflector;
  let guard: JwtAuthGuard;

  const buildContext = (): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtAuthGuard(reflector);
  });

  describe('canActivate', () => {
    it('bỏ qua xác thực (trả true) khi endpoint đánh dấu @Public()', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
      const superCanActivate = jest.spyOn(
        AuthGuard('jwt').prototype,
        'canActivate',
      );

      expect(guard.canActivate(buildContext())).toBe(true);
      expect(superCanActivate).not.toHaveBeenCalled();
    });

    it('gọi xác thực JWT chuẩn khi endpoint không phải @Public()', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      const superCanActivate = jest
        .spyOn(AuthGuard('jwt').prototype, 'canActivate')
        .mockReturnValue(true);

      expect(guard.canActivate(buildContext())).toBe(true);
      expect(superCanActivate).toHaveBeenCalled();
      superCanActivate.mockRestore();
    });

    it('đọc metadata từ đúng key IS_PUBLIC_KEY', () => {
      const spy = jest
        .spyOn(reflector, 'getAllAndOverride')
        .mockReturnValue(false);
      jest
        .spyOn(AuthGuard('jwt').prototype, 'canActivate')
        .mockReturnValue(true);

      void guard.canActivate(buildContext());

      expect(spy).toHaveBeenCalledWith(IS_PUBLIC_KEY, expect.any(Array));
    });
  });

  describe('handleRequest', () => {
    it('trả về user khi xác thực thành công', () => {
      const user = { id: 'user-1', role: 'user' };
      expect(guard.handleRequest(null, user, undefined)).toBe(user);
    });

    it('ném 401 khi thiếu token (user = false, không có lỗi)', () => {
      expect(() => guard.handleRequest(null, false, undefined)).toThrow(
        UnauthorizedException,
      );
    });

    it('ném 401 khi token hết hạn hoặc sai chữ ký (err từ passport-jwt)', () => {
      const err = new Error('jwt expired');
      expect(() => guard.handleRequest(err, false, undefined)).toThrow(
        UnauthorizedException,
      );
    });

    it('giữ message rõ ràng từ passport info khi có', () => {
      expect(() =>
        guard.handleRequest(null, false, { message: 'jwt malformed' }),
      ).toThrow('jwt malformed');
    });
  });
});
