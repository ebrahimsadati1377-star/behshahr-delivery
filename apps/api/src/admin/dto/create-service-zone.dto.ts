import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateServiceZoneDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-90)
  @Max(90)
  centerLatitude!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(-180)
  @Max(180)
  centerLongitude!: number;

  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(100000)
  radiusMeters!: number;
}
