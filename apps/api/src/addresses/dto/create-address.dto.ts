import { IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateAddressDto {
  @IsString()
  @MaxLength(80)
  title!: string;

  @IsString()
  @MaxLength(500)
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
  @MaxLength(500)
  details?: string;
}
