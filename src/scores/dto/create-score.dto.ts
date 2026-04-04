import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { LecturerBusinessRole } from '../../common/enums/lecturer-business-role.enum';

export class CreateScoreDto {
  @ApiProperty({ example: 'reg_123456789abc' })
  @IsString()
  registrationId: string;

  @ApiProperty({
    enum: LecturerBusinessRole,
    example: LecturerBusinessRole.SUPERVISOR,
  })
  @IsEnum(LecturerBusinessRole)
  vaiTroCham: LecturerBusinessRole;

  @ApiProperty({ example: 8 })
  @IsNumber()
  @Min(0)
  @Max(10)
  score1: number;

  @ApiProperty({ example: 8.5 })
  @IsNumber()
  @Min(0)
  @Max(10)
  score2: number;

  @ApiProperty({ example: 9 })
  @IsNumber()
  @Min(0)
  @Max(10)
  score3: number;

  @ApiProperty({ example: 8.5 })
  @IsNumber()
  @Min(0)
  @Max(10)
  totalScore: number;

  @ApiPropertyOptional({ example: 'Lam tot' })
  @IsOptional()
  @IsString()
  comments?: string;

  @ApiPropertyOptional({ example: 'Can bo sung phan mo rong' })
  @IsOptional()
  @IsString()
  questions?: string;
}
