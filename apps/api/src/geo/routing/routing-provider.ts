export type RoutingProviderName = 'balad' | 'neshan';
export type TravelMode = 'car' | 'motorcycle';
export interface Coordinates { lat: number; lng: number }
export interface RouteRequest {
  origin: Coordinates;
  destination: Coordinates;
  mode: TravelMode;
}
export interface RouteEstimate {
  provider: RoutingProviderName;
  distanceMeters: number;
  durationSeconds: number;
  trafficAware: boolean;
  measuredAt: string;
}
export interface RoutingProvider {
  readonly name: RoutingProviderName;
  estimate(request: RouteRequest): Promise<RouteEstimate>;
}
export class RoutingUnavailableError extends Error {
  constructor(provider: RoutingProviderName, reason: string) {
    super(`${provider}: ${reason}`);
    this.name = 'RoutingUnavailableError';
  }
}
export function validateCoordinates(point: Coordinates): void {
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng) ||
      point.lat < -90 || point.lat > 90 || point.lng < -180 || point.lng > 180) {
    throw new RangeError('Invalid WGS84 coordinates');
  }
}
export function validateEstimate(estimate: RouteEstimate): RouteEstimate {
  if (!Number.isFinite(estimate.distanceMeters) || estimate.distanceMeters < 0 ||
      !Number.isFinite(estimate.durationSeconds) || estimate.durationSeconds < 0 ||
      !Number.isFinite(Date.parse(estimate.measuredAt))) {
    throw new RangeError('Invalid routing provider estimate');
  }
  return estimate;
}
