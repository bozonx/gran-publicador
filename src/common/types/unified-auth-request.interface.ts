import type { FastifyRequest } from 'fastify';

/**
 * Unified user interface that works for both JWT and API token authentication.
 * Controllers can use this to work with either authentication method.
 */
export interface UnifiedAuthUser {
  /** The unique identifier of the user (from JWT 'sub' or API token 'userId'). */
  userId: string;
  /** Alias for userId for backward compatibility. */
  id: string;
  /** If true, user/token has access to all projects. Only present for API tokens. */
  allProjects?: boolean;
  /** Optional list of specific project IDs this token is allowed to access. Only present for API tokens with limited scope. */
  projectIds?: string[];
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
