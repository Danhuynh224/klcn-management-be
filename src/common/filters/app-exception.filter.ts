import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ErrorCode } from '../enums/error-code.enum';
import { AppException } from '../exceptions/app.exception';

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof AppException) {
      response.status(exception.getStatus()).json({
        success: false,
        message: exception.message,
        errorCode: exception.errorCode,
      });
      return;
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const payload =
        typeof exceptionResponse === 'string'
          ? { message: exceptionResponse }
          : exceptionResponse;
      const message = Array.isArray((payload as { message?: string[] }).message)
        ? (payload as { message?: string[] }).message?.join(', ')
        : (payload as { message?: string }).message;

      response.status(status).json({
        success: false,
        message: message ?? 'Request failed',
        errorCode:
          (payload as { errorCode?: ErrorCode }).errorCode ??
          ErrorCode.RESOURCE_NOT_FOUND,
      });
      return;
    }

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Internal server error',
      errorCode: ErrorCode.RESOURCE_NOT_FOUND,
    });
  }
}
