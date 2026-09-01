import { RoutingMode } from '../geo/routing.provider';

export interface AddressSnapshot {
  title: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  details: string | null;
}

export interface LockedQuote {
  quoteId: string;
  userId: string;
  pickupAddressId?: string;
  dropoffAddressId?: string;
  pickupSnapshot: AddressSnapshot;
  dropoffSnapshot: AddressSnapshot;
  vehicleType: 'MOTORBIKE' | 'CAR';
  distanceMeters: number;
  estimatedDurationSeconds: number;
  priceToman: number;
  pricingRuleId: string;
  routingMode: RoutingMode;
  expiresAt: string;
}
