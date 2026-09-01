import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, Max, Min } from 'class-validator';

export class CreatePricingRuleDto {
  @IsIn(['MOTORBIKE', 'CAR'])
  vehicleType!: 'MOTORBIKE' | 'CAR';

  @Type(() => Number)
  @IsInt()
  @Min(0)
  baseFare!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  includedDistanceMeters!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  perKmFare!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  minimumFare!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.1)
  @Max(10)
  surgeMultiplier!: number;
}
