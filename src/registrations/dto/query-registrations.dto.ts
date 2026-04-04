import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { RegistrationStatus } from '../../common/enums/registration-status.enum';
import { RegistrationType } from '../../common/enums/registration-type.enum';

export class QueryRegistrationsDto {
  @ApiPropertyOptional({ enum: RegistrationType })
  @IsOptional()
  @IsEnum(RegistrationType)
  loai?: RegistrationType;

  @ApiPropertyOptional({ enum: RegistrationStatus })
  @IsOptional()
  @IsEnum(RegistrationStatus)
  status?: RegistrationStatus;

  @ApiPropertyOptional({ example: 'DOT1-2026' })
  @IsOptional()
  @IsString()
  dot?: string;

  @ApiPropertyOptional({ example: 'gv01@ute.edu.vn' })
  @IsOptional()
  @IsString()
  emailGVHD?: string;

  @ApiPropertyOptional({ example: 'gv03@ute.edu.vn' })
  @IsOptional()
  @IsString()
  emailGVPB?: string;

  @ApiPropertyOptional({ example: 'committee_001' })
  @IsOptional()
  @IsString()
  committeeId?: string;

  @ApiPropertyOptional({
    example: 'supervisor',
    description: 'supervisor | reviewer | committee | chair | secretary',
  })
  @IsOptional()
  @IsString()
  roleView?: string;
}
