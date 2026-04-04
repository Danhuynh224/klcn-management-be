import { Module } from '@nestjs/common';
import { RegistrationsModule } from '../registrations/registrations.module';
import { CloudinaryService } from './cloudinary.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [RegistrationsModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, CloudinaryService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
