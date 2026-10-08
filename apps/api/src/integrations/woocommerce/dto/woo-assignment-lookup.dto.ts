import { IsString, MaxLength, MinLength } from 'class-validator';

export class WooAssignmentLookupDto {
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  storeId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  externalOrderId!: string;
}
