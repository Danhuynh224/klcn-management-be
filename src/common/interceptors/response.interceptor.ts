import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next.handle().pipe(
      map((value: unknown) => {
        if (value && typeof value === 'object' && 'success' in value) {
          return value;
        }

        if (
          value &&
          typeof value === 'object' &&
          ('data' in value || 'message' in value)
        ) {
          return {
            success: true,
            ...value,
          };
        }

        return {
          success: true,
          data: value,
        };
      }),
    );
  }
}
