import { Module } from '@nestjs/common';
import { RegistrationStatusHistoryService } from './registration-status-history.service';
import { RegistrationsController } from './registrations.controller';
import { RegistrationsService } from './registrations.service';

@Module({
  controllers: [RegistrationsController],
  providers: [RegistrationsService, RegistrationStatusHistoryService],
  exports: [RegistrationsService, RegistrationStatusHistoryService],
})
export class RegistrationsModule {}
