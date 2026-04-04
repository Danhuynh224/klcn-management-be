import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class FinalizeScoreDto {
  @ApiProperty({ example: 'average' })
  @IsString()
  formula: string;
}
