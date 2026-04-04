import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { RegistrationStatus } from '../../common/enums/registration-status.enum';

export class UpdateRegistrationStatusDto {
  @ApiProperty({
    enum: RegistrationStatus,
    example: RegistrationStatus.BCTT_PASSED,
  })
  @IsEnum(RegistrationStatus)
  status: RegistrationStatus;
}
