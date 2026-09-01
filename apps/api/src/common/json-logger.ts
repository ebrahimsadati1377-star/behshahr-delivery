import { LoggerService } from '@nestjs/common';

type LogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose' | 'fatal';

type StructuredLog = {
  timestamp: string;
  level: LogLevel;
  context?: string;
  message?: string;
  [key: string]: unknown;
};

export class JsonLogger implements LoggerService {
  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('log', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('verbose', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write('fatal', message, optionalParams);
  }

  private write(level: LogLevel, message: unknown, optionalParams: unknown[]): void {
    const params = [...optionalParams];
    const context = typeof params.at(-1) === 'string' ? String(params.pop()) : undefined;
    const entry: StructuredLog = {
      timestamp: new Date().toISOString(),
      level,
      ...(context ? { context } : {}),
      ...this.normalizeMessage(message),
    };

    if (params.length) entry.params = params.map((value) => this.safeValue(value));

    const serialized = JSON.stringify(entry, this.jsonReplacer);
    if (level === 'error' || level === 'fatal') {
      process.stderr.write(`${serialized}\n`);
    } else {
      process.stdout.write(`${serialized}\n`);
    }
  }

  private normalizeMessage(message: unknown): Record<string, unknown> {
    if (message instanceof Error) {
      return {
        message: message.message,
        errorName: message.name,
        stack: message.stack,
      };
    }

    if (message && typeof message === 'object' && !Array.isArray(message)) {
      return this.safeValue(message) as Record<string, unknown>;
    }

    return { message: String(message) };
  }

  private safeValue(value: unknown): unknown {
    if (value instanceof Error) {
      return { name: value.name, message: value.message, stack: value.stack };
    }
    return value;
  }

  private readonly jsonReplacer = (_key: string, value: unknown): unknown => {
    if (typeof value === 'bigint') return value.toString();
    if (value instanceof Error) {
      return { name: value.name, message: value.message, stack: value.stack };
    }
    return value;
  };
}
