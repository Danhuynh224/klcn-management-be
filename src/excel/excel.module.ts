import { Global, Module } from '@nestjs/common';
import { SHEET_REPOSITORY } from '../common/constants/injection-tokens';
import { GoogleSheetsService } from './excel.service';

@Global()
@Module({
  providers: [
    GoogleSheetsService,
    {
      provide: SHEET_REPOSITORY,
      useExisting: GoogleSheetsService,
    },
  ],
  exports: [GoogleSheetsService, SHEET_REPOSITORY],
})
export class ExcelModule {}
