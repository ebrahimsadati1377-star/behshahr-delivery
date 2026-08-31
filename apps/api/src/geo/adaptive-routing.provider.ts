import { Injectable, Logger } from '@nestjs/common';
import { ApproximateRoutingProvider } from './approximate-routing.provider';
import { Coordinate } from './geo.utils';
import { NeshanRoutingProvider } from './neshan-routing.provider';
import { RouteEstimate, RoutingProvider } from './routing.provider';

type RoutingProviderMode = 'approximate' | 'neshan' | 'auto';

@Injectable()
export class AdaptiveRoutingProvider extends RoutingProvider {
  private readonly logger = new Logger(AdaptiveRoutingProvider.name);

  constructor(
    private readonly approximate: ApproximateRoutingProvider,
    private readonly neshan: NeshanRoutingProvider,
  ) {
    super();
  }

  async estimate(from: Coordinate, to: Coordinate): Promise<RouteEstimate> {
    const provider = this.providerMode();

    if (provider === 'approximate') {
      return this.approximate.estimate(from, to);
    }

    if (provider === 'neshan') {
      return this.neshan.estimate(from, to);
    }

    if (!process.env.NESHAN_SERVICE_API_KEY?.trim()) {
      return this.approximate.estimate(from, to);
    }

    try {
      return await this.neshan.estimate(from, to);
    } catch (error) {
      this.logger.warn(
        `Neshan routing unavailable; using approximate fallback (${error instanceof Error ? error.message : 'unknown error'})`,
      );
      const fallback = await this.approximate.estimate(from, to);
      return { ...fallback, mode: 'APPROXIMATE_FALLBACK' };
    }
  }

  private providerMode(): RoutingProviderMode {
    const value = (process.env.ROUTING_PROVIDER ?? 'approximate').trim().toLowerCase();
    if (value === 'approximate' || value === 'neshan' || value === 'auto') return value;
    throw new Error('ROUTING_PROVIDER must be approximate, neshan, or auto');
  }
}
