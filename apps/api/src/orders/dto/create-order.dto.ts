import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateOrderDto {
  @IsUUID('4')
  quoteId!: string;

  @IsOptional()
  @IsIn(['CASH', 'ONLINE'])
  paymentMethod?: 'CASH' | 'ONLINE';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
