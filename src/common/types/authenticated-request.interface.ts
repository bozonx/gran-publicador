import type { FastifyRequest } from 'fastify';
import type { JwtPayload } from './jwt-payload.interface.js';

/**
 * Interface extending the FastifyRequest to include the authenticated user.
 * This ensures that request objects in protected routes have a typed user property.
 */
export interface AuthenticatedRequest extends FastifyRequest {
  /** The authenticated user's payload extracted from the JWT. */
  user: JwtPayload;
}
