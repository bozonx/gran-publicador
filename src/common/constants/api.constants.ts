/**
 * The current API version of the application.
 */
export const API_VERSION = 'v1';

/**
 * The prefix used for all API routes.
 */
export const API_PREFIX = 'api';

/**
 * The prefix used for external integration routes.
 */
export const EXTERNAL_PREFIX = 'external';

/**
 * The full global prefix for the API, combining prefix and version.
 * Example: api/v1
 */
export const GLOBAL_PREFIX = `${API_PREFIX}/${API_VERSION}`;
