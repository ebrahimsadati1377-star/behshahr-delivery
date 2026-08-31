import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateOrderDto {
  @IsUUID('4')
  quoteId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
