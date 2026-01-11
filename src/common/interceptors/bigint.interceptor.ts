import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Interceptor to handle BigInt serialization.
 * Recursively traverses the response object and converts all BigInt values to strings.
 * This avoids the "Do not know how to serialize a BigInt" error without patching BigInt.prototype.
 */
@Injectable()
export class BigIntInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map(data => this.serializeBigInt(data)));
  }

  private serializeBigInt(data: any): any {
    if (data === null || data === undefined) {
      return data;
    }

    if (typeof data === 'bigint') {
      return data.toString();
    }

    if (data instanceof Date) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.serializeBigInt(item));
    }

    if (typeof data === 'object') {
      const serializedObject: any = {};
      for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
          serializedObject[key] = this.serializeBigInt(data[key]);
        }
      }
      return serializedObject;
    }

    return data;
  }
}
