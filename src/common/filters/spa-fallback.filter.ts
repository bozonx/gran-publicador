import { Catch, NotFoundException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Global exception filter that handles 404 errors for SPA routing.
 * When a route is not found and it's not an API route, serves the SPA fallback (200.html)
 * to allow client-side routing to handle the request.
 */
@Catch(NotFoundException)
export class SpaFallbackFilter implements ExceptionFilter {
  constructor(private readonly apiPrefix: string) {}

  public catch(exception: NotFoundException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<FastifyRequest>();
    const reply = ctx.getResponse<FastifyReply>();
    const url = request.url;

    // If it's an API route, return the normal 404 response
    if (url.startsWith(`/${this.apiPrefix}`)) {
      void reply.code(404).send({
        statusCode: 404,
        message: exception.message ?? 'Not Found',
        error: 'Not Found',
      });
      return;
    }

    // For all other routes, serve the SPA fallback
    void reply.sendFile('200.html');
  }
}
