import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsNumber, IsObject, IsOptional, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

class WooCommerceCustomerDto {
  @IsString()
  @MaxLength(160)
  name!: string;

  @IsString()
  @MaxLength(20)
  phone!: string;
}

class WooCommerceAddressDto {
  @IsString()
  @MaxLength(80)
  title!: string;

  @IsString()
  @MaxLength(1200)
  formattedAddress!: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  details?: string;
}

class WooCommercePaymentDto {
  @IsBoolean()
  paid!: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  methodId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  methodTitle?: string;
}

export class CreateWooCommerceOrderDto {
  @IsString()
  @MaxLength(80)
  storeId!: string;

  @IsString()
  @MaxLength(120)
  externalOrderId!: string;

  @ValidateNested()
  @Type(() => WooCommerceCustomerDto)
  customer!: WooCommerceCustomerDto;

  @ValidateNested()
  @Type(() => WooCommerceAddressDto)
  pickup!: WooCommerceAddressDto;

  @ValidateNested()
  @Type(() => WooCommerceAddressDto)
  dropoff!: WooCommerceAddressDto;

  @IsIn(['MOTORBIKE', 'CAR'])
  vehicleType!: 'MOTORBIKE' | 'CAR';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => WooCommercePaymentDto)
  payment?: WooCommercePaymentDto;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
