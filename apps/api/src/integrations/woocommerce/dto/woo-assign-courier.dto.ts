import { IsUUID } from 'class-validator';
import { WooAssignmentLookupDto } from './woo-assignment-lookup.dto';

export class WooAssignCourierDto extends WooAssignmentLookupDto {
  @IsUUID()
  courierId!: string;
}
