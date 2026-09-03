import { IsIn, IsString, MaxLength } from 'class-validator';

export class UpdateWooCommerceOrderStatusDto {
  @IsString()
  @MaxLength(80)
  storeId!: string;

  @IsString()
  @MaxLength(120)
  externalOrderId!: string;

  @IsIn(['completed'])
  status!: 'completed';
}
