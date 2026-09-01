import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Coordinate } from './geo.utils';
import { RouteEstimate } from './routing.provider';

type MapIrRouteResponse = {
  routes?: Array<{
    distance?: number;
    duration?: number;
  }>;
};

@Injectable()
export class MapIrRoutingProvider {
  async estimate(from: Coordinate, to: Coordinate): Promise<RouteEstimate> {
    const apiKey = process.env.MAPIR_API_KEY?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException('Map.ir API key is not configured');
    }

    const baseUrl = (process.env.MAPIR_API_BASE_URL ?? 'https://map.ir').replace(/\/$/, '');
    const timeoutMs = this.positiveNumberEnv('MAPIR_ROUTING_TIMEOUT_MS', 5000);
    const coordinates = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
    const url = new URL(`${baseUrl}/routes/route/v1/driving/${coordinates}`);
    url.searchParams.set('alternatives', 'false');
    url.searchParams.set('steps', 'false');
    url.searchParams.set('overview', 'false');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'x-api-key': apiKey,
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new ServiceUnavailableException(`Map.ir routing failed with status ${response.status}`);
      }

      const body = (await response.json()) as MapIrRouteResponse;
      const route = body.routes?.[0];
      if (!route) {
        throw new ServiceUnavailableException('Map.ir routing returned no route');
      }

      const distanceMeters = Math.ceil(this.validMetric(route.distance, 'distance'));
      const durationSeconds = Math.ceil(this.validMetric(route.duration, 'duration'));

      if (distanceMeters <= 0 || durationSeconds <= 0) {
        throw new ServiceUnavailableException('Map.ir routing returned invalid route metrics');
      }

      return { distanceMeters, durationSeconds, mode: 'MAPIR' };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      const reason = error instanceof Error && error.name === 'AbortError' ? 'timed out' : 'request failed';
      throw new ServiceUnavailableException(`Map.ir routing ${reason}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  private validMetric(value: unknown, name: string): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      throw new ServiceUnavailableException(`Map.ir routing returned invalid ${name}`);
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
