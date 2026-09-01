import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JsonLogger } from './json-logger';

type RequestLike = {
  method?: string;
  originalUrl?: string;
  url?: string;
  requestId?: string;
};

type ResponseLike = {
  status(code: number): ResponseLike;
  json(body: unknown): void;
};

type HttpExceptionBody = {
  message?: string | string[];
  error?: string;
  statusCode?: number;
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: JsonLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestLike>();
    const response = context.getResponse<ResponseLike>();
    const statusCode = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const normalized = this.normalizeException(exception, statusCode);
    const path = request.originalUrl ?? request.url ?? '';
    const requestId = request.requestId ?? 'unknown';

    if (statusCode >= 500) {
      this.logger.error({
        event: 'http_exception',
        requestId,
        method: request.method,
        path,
        statusCode,
        error: exception instanceof Error
          ? { name: exception.name, message: exception.message, stack: exception.stack }
          : String(exception),
      });
    } else {
      this.logger.warn({
        event: 'http_exception',
        requestId,
        method: request.method,
        path,
        statusCode,
        code: this.errorCode(statusCode),
        message: normalized.message,
      });
    }

    response.status(statusCode).json({
      statusCode,
      code: this.errorCode(statusCode),
      message: normalized.message,
      ...(normalized.details?.length ? { details: normalized.details } : {}),
      path,
      requestId,
      timestamp: new Date().toISOString(),
    });
  }

  private normalizeException(
    exception: unknown,
    statusCode: number,
  ): { message: string; details?: string[] } {
    if (!(exception instanceof HttpException)) {
      return { message: 'Internal server error' };
    }

    const body = exception.getResponse();
    if (typeof body === 'string') return { message: body };

    if (body && typeof body === 'object') {
      const typed = body as HttpExceptionBody;
      if (Array.isArray(typed.message)) {
        return { message: 'Validation failed', details: typed.message.map(String) };
      }
      if (typeof typed.message === 'string') return { message: typed.message };
      if (typeof typed.error === 'string') return { message: typed.error };
    }

    return {
      message: statusCode >= 500 ? 'Internal server error' : 'Request failed',
    };
  }

  private errorCode(statusCode: number): string {
    switch (statusCode) {
      case 400: return 'BAD_REQUEST';
      case 401: return 'UNAUTHORIZED';
      case 403: return 'FORBIDDEN';
      case 404: return 'NOT_FOUND';
      case 409: return 'CONFLICT';
      case 422: return 'UNPROCESSABLE_ENTITY';
      case 429: return 'TOO_MANY_REQUESTS';
      case 500: return 'INTERNAL_SERVER_ERROR';
      case 502: return 'BAD_GATEWAY';
      case 503: return 'SERVICE_UNAVAILABLE';
      case 504: return 'GATEWAY_TIMEOUT';
      default: return `HTTP_${statusCode}`;
    }
  }
}
