import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class AssignRegistrationDto {
  @ApiProperty({ example: 'reg_123456789abc' })
  @IsString()
  registrationId: string;
}
