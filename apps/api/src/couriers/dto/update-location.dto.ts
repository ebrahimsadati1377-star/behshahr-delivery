import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsNumber } from 'class-validator';

export class UpdateCourierLocationDto {
  @Type(() => Number)
  @IsNumber()
  @IsLatitude()
  latitude!: number;

  @Type(() => Number)
  @IsNumber()
  @IsLongitude()
  longitude!: number;
}
