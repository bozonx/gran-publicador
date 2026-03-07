import { SetMetadata } from '@nestjs/common';

export const REQUIRE_SCOPES_KEY = 'require_scopes';

/**
 * Decorator to require specific scopes for an API token.
 * Use with ScopesGuard.
 */
export const RequireScopes = (...scopes: string[]) => SetMetadata(REQUIRE_SCOPES_KEY, scopes);
