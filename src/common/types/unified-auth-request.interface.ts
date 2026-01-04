import type { FastifyRequest } from 'fastify';

/**
 * Unified user interface that works for both JWT and API token authentication.
 * Controllers can use this to work with either authentication method.
 */
export interface UnifiedAuthUser {
  /** The unique identifier of the user (from JWT 'sub' or API token 'userId'). */
  userId: string;
  /** Optional list of project IDs this user/token is allowed to access. Empty or undefined means all. */
  scopeProjectIds?: string[];
  /** Optional token ID if authenticated via API token. */
  tokenId?: string;
}

/**
 * Interface extending the FastifyRequest to include the unified authenticated user.
 * This works for both JWT and API token authentication.
 */
export interface UnifiedAuthRequest extends FastifyRequest {
  /** The authenticated user from either JWT or API token. */
  user: UnifiedAuthUser;
}
