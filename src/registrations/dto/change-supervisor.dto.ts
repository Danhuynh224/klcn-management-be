import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ChangeSupervisorDto {
  @ApiProperty({ example: 'gv02@ute.edu.vn' })
  @IsEmail()
  emailGVHD: string;
}
