/**
 * Interface representing a user authenticated via API token.
 */
export interface ApiTokenUser {
  /** The unique identifier of the user who owns the token. */
  userId: string;
  /** Alias for userId for backward compatibility. */
  id: string;
  /** If true, token has access to all user's projects (including future ones). */
  allProjects: boolean;
  /** List of specific project IDs this token is allowed to access. Empty if allProjects=true. */
  projectIds: string[];
  /** The unique identifier of the API token itself. */
  tokenId: string;
  /** List of authorized scopes (e.g., 'vfs:read', 'stt:transcribe'). */
  scopes: string[];
  /** The human-readable name of the token. */
  name: string;
}

/**
 * Interface extending the request object to include the API token user.
 */
export interface ApiTokenRequest {
  /** The user information derived from the validated API token. */
  user: ApiTokenUser;
}
