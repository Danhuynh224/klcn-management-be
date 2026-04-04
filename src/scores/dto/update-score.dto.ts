import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { LecturerBusinessRole } from '../../common/enums/lecturer-business-role.enum';

export class UpdateScoreDto {
  @ApiPropertyOptional({ enum: LecturerBusinessRole })
  @IsOptional()
  @IsEnum(LecturerBusinessRole)
  vaiTroCham?: LecturerBusinessRole;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  score1?: number;

  @ApiPropertyOptional({ example: 8.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  score2?: number;

  @ApiPropertyOptional({ example: 9 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  score3?: number;

  @ApiPropertyOptional({ example: 8.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  totalScore?: number;

  @ApiPropertyOptional({ example: 'Cap nhat nhan xet' })
  @IsOptional()
  @IsString()
  comments?: string;

  @ApiPropertyOptional({ example: 'Cap nhat cau hoi' })
  @IsOptional()
  @IsString()
  questions?: string;
}
