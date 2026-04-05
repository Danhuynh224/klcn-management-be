import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { MinutesController } from './minutes.controller';
import { MinutesService } from './minutes.service';

@Module({
  imports: [DocumentsModule],
  controllers: [MinutesController],
  providers: [MinutesService],
})
export class MinutesModule {}
