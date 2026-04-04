import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../enums/error-code.enum';

export class AppException extends HttpException {
  constructor(
    message: string,
    status = HttpStatus.BAD_REQUEST,
    readonly errorCode: ErrorCode = ErrorCode.RESOURCE_NOT_FOUND,
  ) {
    super({ message, errorCode }, status);
  }
}
