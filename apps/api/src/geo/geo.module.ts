import { Global, Module } from '@nestjs/common';
import { ApproximateRoutingProvider } from './approximate-routing.provider';
import { RoutingProvider } from './routing.provider';
import { ServiceAreaService } from './service-area.service';

@Global()
@Module({
  providers: [
    ServiceAreaService,
    ApproximateRoutingProvider,
    {
      provide: RoutingProvider,
      useExisting: ApproximateRoutingProvider,
    },
  ],
  exports: [ServiceAreaService, RoutingProvider],
})
export class GeoModule {}
