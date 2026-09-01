import { Coordinate } from './geo.utils';

export type RoutingMode = 'APPROXIMATE' | 'APPROXIMATE_FALLBACK' | 'NESHAN' | 'MAPIR';

export interface RouteEstimate {
  distanceMeters: number;
  durationSeconds: number;
  mode: RoutingMode;
}

export abstract class RoutingProvider {
  abstract estimate(from: Coordinate, to: Coordinate): Promise<RouteEstimate>;
}
