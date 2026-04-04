import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ApproveRegistrationDto {
  @ApiPropertyOptional({ example: 'Ten de tai da chinh sua' })
  @IsOptional()
  @IsString()
  tenDeTai?: string;
}
