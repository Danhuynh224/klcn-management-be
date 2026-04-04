import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { CommitteesModule } from './committees/committees.module';
import { DashboardsModule } from './dashboards/dashboards.module';
import { DocumentsModule } from './documents/documents.module';
import { ExcelModule } from './excel/excel.module';
import { FieldsModule } from './fields/fields.module';
import { AppExceptionFilter } from './common/filters/app-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { MinutesModule } from './minutes/minutes.module';
import { NotificationsModule } from './notifications/notifications.module';
import { QuotasModule } from './quotas/quotas.module';
import { RegistrationsModule } from './registrations/registrations.module';
import { ScoresModule } from './scores/scores.module';
import { TermsModule } from './terms/terms.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ExcelModule,
    AuthModule,
    UsersModule,
    QuotasModule,
    FieldsModule,
    TermsModule,
    RegistrationsModule,
    DocumentsModule,
    ScoresModule,
    CommitteesModule,
    MinutesModule,
    NotificationsModule,
    DashboardsModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AppExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
  ],
})
export class AppModule {}
