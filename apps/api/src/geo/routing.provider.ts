import { Coordinate } from './geo.utils';

export interface RouteEstimate {
  distanceMeters: number;
  durationSeconds: number;
  mode: 'APPROXIMATE';
}

export abstract class RoutingProvider {
  abstract estimate(from: Coordinate, to: Coordinate): Promise<RouteEstimate>;
}
