import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UploadDocumentDto } from './dto/upload-document.dto';
import { DocumentsService } from './documents.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';

@ApiTags('Documents')
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @ApiOperation({ summary: 'Upload student or lecturer document' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        registrationId: { type: 'string', example: 'reg_123456789abc' },
        documentType: { type: 'string', example: 'KLTN_REPORT' },
        file: { type: 'string', format: 'binary' },
      },
      required: ['registrationId', 'documentType', 'file'],
    },
  })
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 20 * 1024 * 1024,
      },
    }),
  )
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: UploadDocumentDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.documentsService.upload(user, payload, file);
  }

  @ApiOperation({ summary: 'Get all documents by registration id' })
  @ApiParam({ name: 'registrationId' })
  @Get('registration/:registrationId')
  getByRegistration(
    @Param('registrationId') registrationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.getByRegistration(registrationId, user);
  }
}
