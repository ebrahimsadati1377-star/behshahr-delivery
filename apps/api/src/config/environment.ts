type NodeEnvironment = 'development' | 'test' | 'production';
type SmsProviderMode = 'console' | 'ippanel';
type RoutingProviderMode = 'approximate' | 'mapir' | 'neshan' | 'auto';

export type ValidatedEnvironment = {
  nodeEnv: NodeEnvironment;
  apiPort: number;
  smsProvider: SmsProviderMode;
  routingProvider: RoutingProviderMode;
};

export function validateEnvironment(): ValidatedEnvironment {
  const nodeEnv = enumValue<NodeEnvironment>('NODE_ENV', ['development', 'test', 'production'], 'development');
  const apiPort = positiveInteger('API_PORT', 4000);

  required('DATABASE_URL');
  required('REDIS_URL');
  required('OTP_SECRET');
  required('JWT_ACCESS_SECRET');
  required('JWT_REFRESH_SECRET');

  const smsProvider = enumValue<SmsProviderMode>('SMS_PROVIDER', ['console', 'ippanel'], 'console');
  if (nodeEnv === 'production' && smsProvider !== 'ippanel') {
    throw new Error('SMS_PROVIDER must be ippanel in production');
  }
  if (smsProvider === 'ippanel') {
    required('IPPANEL_API_KEY');
    required('IPPANEL_FROM_NUMBER');
    required('IPPANEL_OTP_PATTERN_CODE');
    optionalPositiveInteger('IPPANEL_TIMEOUT_MS');
    optionalUrl('IPPANEL_API_BASE_URL');
  }

  const routingProvider = enumValue<RoutingProviderMode>(
    'ROUTING_PROVIDER',
    ['approximate', 'mapir', 'neshan', 'auto'],
    'approximate',
  );
  if (routingProvider === 'mapir') required('MAPIR_API_KEY');
  if (routingProvider === 'neshan') required('NESHAN_SERVICE_API_KEY');
  optionalPositiveInteger('MAPIR_ROUTING_TIMEOUT_MS');
  optionalUrl('MAPIR_API_BASE_URL');
  optionalPositiveInteger('NESHAN_ROUTING_TIMEOUT_MS');
  optionalUrl('NESHAN_API_BASE_URL');

  optionalNumber('SERVICE_CENTER_LAT', -90, 90);
  optionalNumber('SERVICE_CENTER_LNG', -180, 180);
  optionalPositiveInteger('SERVICE_RADIUS_METERS');
  optionalPositiveNumber('ROUTE_DISTANCE_FACTOR');
  optionalPositiveNumber('ROUTE_AVG_SPEED_KMH');

  return { nodeEnv, apiPort, smsProvider, routingProvider };
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function enumValue<T extends string>(name: string, allowed: readonly T[], fallback: T): T {
  const raw = (process.env[name] ?? fallback).trim().toLowerCase();
  if (!allowed.includes(raw as T)) {
    throw new Error(`${name} must be one of: ${allowed.join(', ')}`);
  }
  return raw as T;
}

function positiveInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0 || value > 65535) {
    throw new Error(`${name} must be a positive integer up to 65535`);
  }
  return value;
}

function optionalPositiveInteger(name: string): void {
  const raw = process.env[name];
  if (!raw) return;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
}

function optionalPositiveNumber(name: string): void {
  const raw = process.env[name];
  if (!raw) return;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number`);
}

function optionalNumber(name: string, minimum: number, maximum: number): void {
  const raw = process.env[name];
  if (!raw) return;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}`);
  }
}

function optionalUrl(name: string): void {
  const raw = process.env[name]?.trim();
  if (!raw) return;
  try {
    new URL(raw);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
}
