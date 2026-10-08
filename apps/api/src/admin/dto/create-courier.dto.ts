import { IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateCourierDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(/\S/, { message: 'Name cannot be blank' })
  fullName!: string;

  @IsString()
  @Matches(/^(?:09\d{9}|989\d{9}|\+989\d{9})$/, { message: 'Invalid Iranian mobile number' })
  phone!: string;

  @IsIn(['MOTORBIKE', 'CAR'])
  vehicleType!: 'MOTORBIKE' | 'CAR';
}
