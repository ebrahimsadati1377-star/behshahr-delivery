import { IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateCourierDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/\S/, { message: 'Name cannot be blank' })
  fullName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^(?:09\d{9}|989\d{9}|\+989\d{9})$/, { message: 'Invalid Iranian mobile number' })
  phone?: string;

  @IsOptional()
  @IsIn(['MOTORBIKE', 'CAR'])
  vehicleType?: 'MOTORBIKE' | 'CAR';
}
