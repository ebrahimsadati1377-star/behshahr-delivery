import { IsIn } from 'class-validator';

export class UpdateCourierAvailabilityDto {
  @IsIn(['AVAILABLE', 'OFFLINE'])
  status!: 'AVAILABLE' | 'OFFLINE';
}
