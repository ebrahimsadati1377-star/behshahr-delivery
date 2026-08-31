import { Injectable } from '@nestjs/common';
import { Coordinate, haversineDistanceMeters } from './geo.utils';
import { RouteEstimate, RoutingProvider } from './routing.provider';

@Injectable()
export class ApproximateRoutingProvider implements RoutingProvider {
  async estimate(from: Coordinate, to: Coordinate): Promise<RouteEstimate> {
    const factor = this.numberEnv('ROUTE_DISTANCE_FACTOR', 1.25);
    const averageSpeedKmh = this.numberEnv('ROUTE_AVG_SPEED_KMH', 25);
    const directDistance = haversineDistanceMeters(from, to);
    const distanceMeters = Math.max(1, Math.ceil(directDistance * factor));
    const metersPerSecond = (averageSpeedKmh * 1000) / 3600;
    const durationSeconds = Math.max(
      60,
      Math.ceil(distanceMeters / metersPerSecond),
    );

    return {
      distanceMeters,
      durationSeconds,
      mode: 'APPROXIMATE',
    };
  }

  private numberEnv(name: string, fallback: number): number {
    const raw = process.env[name];

    if (!raw) {
      return fallback;
    }

    const value = Number(raw);

    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`${name} must be a positive number`);
    }

    return value;
  }
}
