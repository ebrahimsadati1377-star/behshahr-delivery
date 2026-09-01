import { IsOptional, IsString, MaxLength } from 'class-validator';

export class MarkPaymentPaidDto {
  @IsOptional()
  @IsString()
  @MaxLength(160)
  reference?: string;
}
