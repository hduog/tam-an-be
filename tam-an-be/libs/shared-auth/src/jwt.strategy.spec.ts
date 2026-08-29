import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from './enums/user-role.enum';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  const config = new ConfigService({ JWT_ACCESS_SECRET: 'x'.repeat(32) });
  const strategy = new JwtStrategy(config);

  it('trả về { id, role } khi payload hợp lệ', () => {
    const result = strategy.validate({
      sub: 'user-id-1',
      role: UserRole.USER,
    });

    expect(result).toEqual({ id: 'user-id-1', role: UserRole.USER });
  });

  it('ném UnauthorizedException khi payload thiếu sub', () => {
    expect(() => strategy.validate({ sub: '', role: UserRole.USER })).toThrow(
      UnauthorizedException,
    );
  });

  it('ném UnauthorizedException khi payload thiếu role', () => {
    expect(() => strategy.validate({ sub: 'user-id-1' } as never)).toThrow(
      UnauthorizedException,
    );
  });
});
