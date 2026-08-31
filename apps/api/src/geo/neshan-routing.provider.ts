import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Coordinate } from './geo.utils';
import { RouteEstimate } from './routing.provider';

type NeshanDirectionResponse = {
  routes?: Array<{
    legs?: Array<{
      distance?: { value?: number };
      duration?: { value?: number };
    }>;
  }>;
};

@Injectable()
export class NeshanRoutingProvider {
  async estimate(from: Coordinate, to: Coordinate): Promise<RouteEstimate> {
    const apiKey = process.env.NESHAN_SERVICE_API_KEY?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException('Neshan routing key is not configured');
    }

    const baseUrl = (process.env.NESHAN_API_BASE_URL ?? 'https://api.neshan.org').replace(/\/$/, '');
    const timeoutMs = this.positiveNumberEnv('NESHAN_ROUTING_TIMEOUT_MS', 5000);
    const url = new URL(`${baseUrl}/v2/direction`);
    url.searchParams.set('origin', `${from.latitude},${from.longitude}`);
    url.searchParams.set('destination', `${to.latitude},${to.longitude}`);
    url.searchParams.set('avoidTrafficZone', 'false');
    url.searchParams.set('avoidOddEvenZone', 'false');
    url.searchParams.set('alternative', 'false');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Api-Key': apiKey,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new ServiceUnavailableException(`Neshan routing failed with status ${response.status}`);
      }

      const body = (await response.json()) as NeshanDirectionResponse;
      const legs = body.routes?.[0]?.legs;
      if (!legs?.length) {
        throw new ServiceUnavailableException('Neshan routing returned no route');
      }

      const distanceMeters = Math.ceil(
        legs.reduce((total, leg) => total + this.validMetric(leg.distance?.value, 'distance'), 0),
      );
      const durationSeconds = Math.ceil(
        legs.reduce((total, leg) => total + this.validMetric(leg.duration?.value, 'duration'), 0),
      );

      if (distanceMeters <= 0 || durationSeconds <= 0) {
        throw new ServiceUnavailableException('Neshan routing returned invalid route metrics');
      }

      return { distanceMeters, durationSeconds, mode: 'NESHAN' };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      const reason = error instanceof Error && error.name === 'AbortError' ? 'timed out' : 'request failed';
      throw new ServiceUnavailableException(`Neshan routing ${reason}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  private validMetric(value: unknown, name: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new ServiceUnavailableException(`Neshan routing returned invalid ${name}`);
    }
    return value;
  }

  private positiveNumberEnv(name: string, fallback: number): number {
    const raw = process.env[name];
    if (!raw) return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be a positive number`);
    return value;
  }
}
