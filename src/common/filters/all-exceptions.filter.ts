import {
  Catch,
  HttpException,
  HttpStatus,
  Inject,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { PinoLogger } from 'nestjs-pino';
import { Prisma } from '../../generated/prisma/index.js';

/**
 * Global exception filter that catches all exceptions
 * and formats them in a consistent way for Fastify responses
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(@Inject(PinoLogger) private readonly logger: PinoLogger) {
    logger.setContext(AllExceptionsFilter.name);
  }

  public catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    const requestPath = (request.url ?? '').split('?')[0] ?? '';

    // Handle specific Prisma errors
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message = this.extractMessage(exception);
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002': // Unique constraint failed
          status = HttpStatus.CONFLICT;
          message = 'Resource already exists';
          break;
        case 'P2025': // Record not found
          status = HttpStatus.NOT_FOUND;
          message = 'Resource not found';
          break;
        case 'P2003': // Foreign key constraint failed
          status = HttpStatus.BAD_REQUEST;
          message = 'Invalid reference';
          break;
        case 'P2014': // Relation violation
          status = HttpStatus.BAD_REQUEST;
          message = 'The change would violate a required relation';
          break;
        default:
          status = HttpStatus.INTERNAL_SERVER_ERROR;
          message = 'Database error';
      }
    } else if (typeof (exception as { statusCode?: unknown })?.statusCode === 'number') {
      status = (exception as { statusCode: number }).statusCode;
      message = this.extractMessage(exception);
    } else {
      message = this.extractMessage(exception);
    }
    const errorResponse = this.buildErrorResponse(exception);

    const safeClientMessage = status >= 500 ? 'Internal server error' : message;
    const safeErrorResponse = status >= 500 ? 'InternalServerError' : errorResponse;

    // Log error for internal tracking
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${requestPath} - ${status} - ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(`${request.method} ${requestPath} - ${status} - ${message}`);
    }

    void response.status(status).send({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: requestPath,
      method: request.method,
      message: safeClientMessage,
      error: safeErrorResponse,
    });
  }

  private extractMessage(exception: unknown): string {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return response;
      }
      if (typeof response === 'object' && response !== null && 'message' in response) {
        const msg = (response as { message: unknown }).message;
        if (Array.isArray(msg)) {
          return msg.join(', ');
        }
        if (typeof msg === 'string') {
          return msg;
        }
      }
      return exception.message;
    }

    if (exception instanceof Error) {
      return exception.message;
    }

    return 'Internal server error';
  }

  private buildErrorResponse(exception: unknown): string | object | undefined {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'object' && response !== null) {
        return response;
      }
      return exception.name;
    }

    if (exception instanceof Error) {
      return exception.name;
    }

    return 'UnknownError';
  }
}
