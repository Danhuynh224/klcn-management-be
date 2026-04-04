import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ChangeReviewerDto {
  @ApiProperty({ example: 'gv03@ute.edu.vn' })
  @IsEmail()
  emailGVPB: string;
}
