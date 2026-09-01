import 'dotenv/config';
import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { JsonLogger } from './common/json-logger';
import { validateEnvironment } from './config/environment';

type RequestLike = {
  headers: Record<string, string | string[] | undefined>;
  method: string;
  originalUrl?: string;
  url?: string;
  requestId?: string;
};

type ResponseLike = {
  statusCode: number;
  setHeader(name: string, value: string): void;
  on(event: 'finish', listener: () => void): void;
};

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,80}$/;
const logger = new JsonLogger();

async function bootstrap(): Promise<void> {
  const environment = validateEnvironment();
  const app = await NestFactory.create(AppModule, { logger });

  app.enableShutdownHooks();
  app.setGlobalPrefix('api');
  app.use((request: RequestLike, response: ResponseLike, next: () => void) => {
    const startedAt = process.hrtime.bigint();
    const incoming = request.headers['x-request-id'];
    const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
    const requestId = candidate && REQUEST_ID_PATTERN.test(candidate)
      ? candidate
      : randomUUID();

    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);
    response.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      logger.log({
        event: 'http_request',
        requestId,
        method: request.method,
        path: pathOnly(request.originalUrl ?? request.url ?? ''),
        statusCode: response.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
      });
    });
    next();
  });
  app.useGlobalFilters(new ApiExceptionFilter(logger));
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(environment.apiPort, '0.0.0.0');
  logger.log({
    event: 'application_started',
    port: environment.apiPort,
    nodeEnv: environment.nodeEnv,
    smsProvider: environment.smsProvider,
    routingProvider: environment.routingProvider,
  });
}

function pathOnly(raw: string): string {
  try {
    return new URL(raw, 'http://localhost').pathname;
  } catch {
    return raw.split('?')[0] ?? raw;
  }
}

void bootstrap().catch((error: unknown) => {
  logger.fatal({
    event: 'application_start_failed',
    error: error instanceof Error
      ? { name: error.name, message: error.message, stack: error.stack }
      : String(error),
  });
  process.exitCode = 1;
});
