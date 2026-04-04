import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { RegistrationType } from '../../common/enums/registration-type.enum';

export class UpdateTermDto {
  @ApiPropertyOptional({ example: 'DOT1-2026' })
  @IsOptional()
  @IsString()
  tenDot?: string;

  @ApiPropertyOptional({
    enum: RegistrationType,
    example: RegistrationType.KLTN,
  })
  @IsOptional()
  @IsEnum(RegistrationType)
  loai?: RegistrationType;

  @ApiPropertyOptional({ example: 'QLCN' })
  @IsOptional()
  @IsString()
  major?: string;

  @ApiPropertyOptional({ example: '2025-2026' })
  @IsOptional()
  @IsString()
  namHoc?: string;

  @ApiPropertyOptional({ example: 'HK2' })
  @IsOptional()
  @IsString()
  hocKy?: string;

  @ApiPropertyOptional({ example: '2026-04-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  registrationOpenAt?: string;

  @ApiPropertyOptional({ example: '2026-04-30T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  registrationCloseAt?: string;

  @ApiPropertyOptional({ example: '2026-05-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  submissionOpenAt?: string;

  @ApiPropertyOptional({ example: '2026-05-31T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  submissionCloseAt?: string;

  @ApiPropertyOptional({ example: '2026-06-10T08:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  defenseDate?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
