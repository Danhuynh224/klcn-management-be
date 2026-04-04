import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsString } from 'class-validator';
import { RegistrationType } from '../../common/enums/registration-type.enum';

export class CreateTermDto {
  @ApiProperty({ example: 'DOT1-2026' })
  @IsString()
  tenDot: string;

  @ApiProperty({ enum: RegistrationType, example: RegistrationType.BCTT })
  @IsEnum(RegistrationType)
  loai: RegistrationType;

  @ApiProperty({ example: 'QLCN' })
  @IsString()
  major: string;

  @ApiProperty({ example: '2025-2026' })
  @IsString()
  namHoc: string;

  @ApiProperty({ example: 'HK2' })
  @IsString()
  hocKy: string;

  @ApiProperty({ example: '2026-04-01T00:00:00.000Z' })
  @IsDateString()
  registrationOpenAt: string;

  @ApiProperty({ example: '2026-04-30T23:59:59.000Z' })
  @IsDateString()
  registrationCloseAt: string;

  @ApiProperty({ example: '2026-05-01T00:00:00.000Z' })
  @IsDateString()
  submissionOpenAt: string;

  @ApiProperty({ example: '2026-05-31T23:59:59.000Z' })
  @IsDateString()
  submissionCloseAt: string;

  @ApiProperty({ example: '2026-06-10T08:00:00.000Z' })
  @IsDateString()
  defenseDate: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  isActive: boolean;
}
