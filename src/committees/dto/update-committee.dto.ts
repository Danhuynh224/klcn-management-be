import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsOptional, IsString } from 'class-validator';

export class UpdateCommitteeDto {
  @ApiPropertyOptional({ example: 'HD 01' })
  @IsOptional()
  @IsString()
  committeeName?: string;

  @ApiPropertyOptional({ example: 'DOT2-2026' })
  @IsOptional()
  @IsString()
  dot?: string;

  @ApiPropertyOptional({ example: 'gv10@ute.edu.vn' })
  @IsOptional()
  @IsEmail()
  chairEmail?: string;

  @ApiPropertyOptional({ example: 'gv11@ute.edu.vn' })
  @IsOptional()
  @IsEmail()
  secretaryEmail?: string;

  @ApiPropertyOptional({ example: 'gv12@ute.edu.vn' })
  @IsOptional()
  @IsEmail()
  member1Email?: string;

  @ApiPropertyOptional({ example: 'gv13@ute.edu.vn' })
  @IsOptional()
  @IsEmail()
  member2Email?: string;

  @ApiPropertyOptional({ example: 'Phong A1' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ example: '2026-07-20T08:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  defenseDate?: string;
}
