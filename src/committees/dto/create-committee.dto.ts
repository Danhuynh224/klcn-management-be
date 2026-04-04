import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsString } from 'class-validator';

export class CreateCommitteeDto {
  @ApiProperty({ example: 'HD 01' })
  @IsString()
  committeeName: string;

  @ApiProperty({ example: 'DOT2-2026' })
  @IsString()
  dot: string;

  @ApiProperty({ example: 'gv10@ute.edu.vn' })
  @IsEmail()
  chairEmail: string;

  @ApiProperty({ example: 'gv11@ute.edu.vn' })
  @IsEmail()
  secretaryEmail: string;

  @ApiProperty({ example: 'gv12@ute.edu.vn' })
  @IsEmail()
  member1Email: string;

  @ApiProperty({ example: 'gv13@ute.edu.vn' })
  @IsEmail()
  member2Email: string;

  @ApiProperty({ example: 'Phong A1' })
  @IsString()
  location: string;

  @ApiProperty({ example: '2026-07-20T08:00:00.000Z' })
  @IsDateString()
  defenseDate: string;
}
