import { IsIn, IsUUID } from 'class-validator';

export class CreateQuoteDto {
  @IsUUID('4')
  pickupAddressId!: string;

  @IsUUID('4')
  dropoffAddressId!: string;

  @IsIn(['MOTORBIKE', 'CAR'])
  vehicleType!: 'MOTORBIKE' | 'CAR';
}
