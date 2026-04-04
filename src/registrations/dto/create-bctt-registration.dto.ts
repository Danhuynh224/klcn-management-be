import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

export class CreateBcttRegistrationDto {
  @ApiProperty({ example: 'He thong quan ly thu vien' })
  @IsString()
  tenDeTai: string;

  @ApiProperty({ example: 'Web' })
  @IsString()
  linhVuc: string;

  @ApiProperty({ example: 'ABC Software' })
  @IsString()
  tenCongTy: string;

  @ApiProperty({ example: 'gv01@ute.edu.vn' })
  @IsEmail()
  emailGVHD: string;

  @ApiProperty({ example: 'DOT1-2026' })
  @IsString()
  dot: string;
}
