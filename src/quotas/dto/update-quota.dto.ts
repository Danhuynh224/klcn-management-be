import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class UpdateQuotaDto {
  @ApiProperty({ example: 12 })
  @IsInt()
  @Min(0)
  quota: number;
}
