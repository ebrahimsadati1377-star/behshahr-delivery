import { Global, Module } from '@nestjs/common';
import { AdaptiveRoutingProvider } from './adaptive-routing.provider';
import { ApproximateRoutingProvider } from './approximate-routing.provider';
import { NeshanRoutingProvider } from './neshan-routing.provider';
import { RoutingProvider } from './routing.provider';
import { ServiceAreaService } from './service-area.service';

@Global()
@Module({
  providers: [
    ServiceAreaService,
    ApproximateRoutingProvider,
    NeshanRoutingProvider,
    AdaptiveRoutingProvider,
    {
      provide: RoutingProvider,
      useExisting: AdaptiveRoutingProvider,
    },
  ],
  exports: [ServiceAreaService, RoutingProvider],
})
export class GeoModule {}
