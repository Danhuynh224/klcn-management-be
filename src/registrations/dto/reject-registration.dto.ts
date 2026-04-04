import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class RejectRegistrationDto {
  @ApiProperty({ example: 'De tai chua phu hop' })
  @IsString()
  reason: string;
}
