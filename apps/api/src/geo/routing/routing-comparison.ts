import {
  RouteEstimate, RouteRequest, RoutingProvider, RoutingProviderName,
  RoutingUnavailableError, validateCoordinates, validateEstimate,
} from './routing-provider';

export type ComparisonResult =
  | { provider: RoutingProviderName; ok: true; estimate: RouteEstimate; latencyMs: number }
  | { provider: RoutingProviderName; ok: false; error: string; latencyMs: number };

export class RoutingComparison {
  constructor(
    private readonly providers: readonly RoutingProvider[],
    private readonly timeoutMs = 2500,
  ) {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new RangeError('Invalid timeout');
  }

  async compare(request: RouteRequest): Promise<ComparisonResult[]> {
    if (process.env.ROUTING_EVALUATION_ENABLED !== 'true') {
      throw new Error('Routing evaluation is disabled');
    }
    validateCoordinates(request.origin);
    validateCoordinates(request.destination);
    if (request.mode !== 'car' && request.mode !== 'motorcycle') {
      throw new RangeError('Unsupported travel mode');
    }
    return Promise.all(this.providers.map(async provider => {
      const start = performance.now();
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        const estimate = await Promise.race([
          provider.estimate(request),
          new Promise<never>((_, reject) => {
            timeout = setTimeout(() => reject(
              new RoutingUnavailableError(provider.name, 'timeout')), this.timeoutMs);
          }),
        ]);
        return {
          provider: provider.name, ok: true as const,
          estimate: validateEstimate(estimate),
          latencyMs: Math.round(performance.now() - start),
        };
      } catch (error) {
        // Do not leak coordinates, provider URLs or credentials into reports.
        return {
          provider: provider.name, ok: false as const,
          error: error instanceof RoutingUnavailableError ? 'unavailable' : 'provider_error',
          latencyMs: Math.round(performance.now() - start),
        };
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    }));
  }
}
