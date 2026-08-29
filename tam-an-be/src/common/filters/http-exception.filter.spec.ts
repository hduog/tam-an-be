import {
  ArgumentsHost,
  BadRequestException,
  ForbiddenException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AllExceptionsFilter } from './http-exception.filter';
import { ErrorResponseBody } from '../interfaces/error-response.interface';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let json: jest.Mock<void, [ErrorResponseBody]>;
  let status: jest.Mock;
  let host: ArgumentsHost;
  let warnSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  const buildHost = (method: string, url: string): ArgumentsHost => {
    json = jest.fn() as jest.Mock<void, [ErrorResponseBody]>;
    status = jest.fn().mockReturnValue({ json });
    return {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ method, url }),
      }),
    } as unknown as ArgumentsHost;
  };

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    host = buildHost('GET', '/auth/me');
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('401: trả đúng format chuẩn và log warning', () => {
    filter.catch(new UnauthorizedException('Invalid token'), host);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        errorCode: 'UNAUTHORIZED',
        message: 'Invalid token',
        path: '/auth/me',
      }),
    );
    const body = json.mock.calls[0][0];
    expect(typeof body.timestamp).toBe('string');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('403: trả đúng format chuẩn, tách biệt rõ với 401, và log warning', () => {
    filter.catch(new ForbiddenException('Insufficient role'), host);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        errorCode: 'FORBIDDEN',
        message: 'Insufficient role',
      }),
    );
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('404: trả đúng format nhưng không log ở mức warning/error (không phải lỗi bảo mật)', () => {
    filter.catch(new NotFoundException('User not found'), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404, errorCode: 'NOT_FOUND' }),
    );
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('400 (ValidationPipe): giữ nguyên mảng message thay vì gộp thành 1 chuỗi', () => {
    filter.catch(
      new BadRequestException({
        message: ['email must be an email', 'password is too weak'],
        error: 'Bad Request',
        statusCode: 400,
      }),
      host,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        errorCode: 'BAD_REQUEST',
        message: ['email must be an email', 'password is too weak'],
      }),
    );
  });

  it('lỗi không phải HttpException (500): không rò rỉ message/stack gốc, chỉ trả message chung', () => {
    filter.catch(new Error('Connection string leaked: postgres://...'), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        errorCode: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error',
      }),
    );
    const body = json.mock.calls[0][0];
    expect(JSON.stringify(body)).not.toContain('postgres://');
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('path lấy đúng từ request.url', () => {
    const customHost = buildHost('PATCH', '/users/me');
    filter.catch(new ForbiddenException(), customHost);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ path: '/users/me' }),
    );
  });
});
