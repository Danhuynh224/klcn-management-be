import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateMinuteDto {
  @ApiProperty({ example: 'Cac gop y cua hoi dong...' })
  @IsString()
  content: string;

  @ApiPropertyOptional({
    example: 'https://res.cloudinary.com/.../minutes.pdf',
  })
  @IsOptional()
  @IsString()
  fileUrl?: string;
}
