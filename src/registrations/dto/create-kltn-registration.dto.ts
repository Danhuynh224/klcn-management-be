import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';

export class CreateKltnRegistrationDto {
  @ApiProperty({ example: 'He thong danh gia do an' })
  @IsString()
  tenDeTai: string;

  @ApiProperty({ example: 'Web' })
  @IsString()
  linhVuc: string;

  @ApiPropertyOptional({ example: 'ABC Software' })
  @IsOptional()
  @IsString()
  tenCongTy?: string;

  @ApiPropertyOptional({ example: 'gv01@ute.edu.vn' })
  @IsOptional()
  @IsEmail()
  emailGVHD?: string;

  @ApiProperty({ example: 'DOT2-2026' })
  @IsString()
  dot: string;
}
