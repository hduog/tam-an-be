import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorResponseBody } from '../interfaces/error-response.interface';

/**
 * Global exception filter — single source of truth for the API's error
 * envelope (see ErrorResponseBody). Registered once in main.ts, catches
 * everything (`@Catch()`), not just auth errors, so every module reuses
 * the same shape instead of each one rolling its own.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, message, errorCode } = this.resolve(exception);

    this.logIfNeeded(status, request, message, exception);

    const body: ErrorResponseBody = {
      statusCode: status,
      errorCode,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    };
    response.status(status).json(body);
  }

  private resolve(exception: unknown): {
    status: HttpStatus;
    message: string | string[];
    errorCode: string;
  } {
    if (exception instanceof HttpException) {
      const status: HttpStatus = exception.getStatus();
      const payload = exception.getResponse();
      // ValidationPipe (and some HttpExceptions) nest the real message
      // inside the response body as `{ message: string | string[] }`.
      const message =
        typeof payload === 'string'
          ? payload
          : ((payload as { message?: string | string[] }).message ??
            exception.message);
      return {
        status,
        message,
        errorCode: this.toErrorCode(exception.constructor.name),
      };
    }

    // Never leak internal error details (message/stack) for anything
    // that isn't a deliberate HttpException.
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      errorCode: 'INTERNAL_SERVER_ERROR',
    };
  }

  private toErrorCode(exceptionClassName: string): string {
    return exceptionClassName
      .replace(/Exception$/, '')
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .toUpperCase();
  }

  private logIfNeeded(
    status: HttpStatus,
    request: Request,
    message: string | string[],
    exception: unknown,
  ): void {
    const summary = `${request.method} ${request.url} -> ${status} ${
      Array.isArray(message) ? message.join('; ') : message
    }`;

    if (status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN) {
      // Security-relevant, but not a bug — warn, not error. Never log
      // request headers/body here (would risk logging tokens/passwords).
      this.logger.warn(summary);
      return;
    }

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(summary, stack);
    }
  }
}
