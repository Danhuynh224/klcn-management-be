import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';
import { DOCUMENT_TYPES } from '../../common/enums/document-type.enum';

export class UploadDocumentDto {
  @ApiProperty({ example: 'reg_123456789abc' })
  @IsString()
  registrationId: string;

  @ApiProperty({ enum: DOCUMENT_TYPES, example: 'KLTN_REPORT' })
  @IsString()
  @IsIn(DOCUMENT_TYPES)
  documentType: string;
}
