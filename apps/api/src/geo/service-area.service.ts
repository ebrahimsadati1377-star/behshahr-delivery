import { BadRequestException, Injectable } from '@nestjs/common';
import { Coordinate, haversineDistanceMeters } from './geo.utils';

@Injectable()
export class ServiceAreaService {
  assertWithinServiceArea(point: Coordinate, label: string): void {
    const center = {
      latitude: this.requiredNumberEnv('SERVICE_CENTER_LAT'),
      longitude: this.requiredNumberEnv('SERVICE_CENTER_LNG'),
    };
    const radiusMeters = this.requiredNumberEnv('SERVICE_RADIUS_METERS');
    const distance = haversineDistanceMeters(center, point);

    if (distance > radiusMeters) {
      throw new BadRequestException(`${label} is outside the service area`);
    }
  }

  private requiredNumberEnv(name: string): number {
    const raw = process.env[name];
    const value = Number(raw);

    if (!raw || !Number.isFinite(value)) {
      throw new Error(`${name} is required and must be numeric`);
    }

    return value;
  }
}
