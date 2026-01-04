/**
 * Interface representing a user authenticated via API token.
 */
export interface ApiTokenUser {
  /** The unique identifier of the user who owns the token. */
  userId: string;
  /** List of project IDs this token is allowed to access. Empty means all. */
  scopeProjectIds: string[];
  /** The unique identifier of the API token itself. */
  tokenId: string;
}

/**
 * Interface extending the request object to include the API token user.
 */
export interface ApiTokenRequest {
  /** The user information derived from the validated API token. */
  user: ApiTokenUser;
}
