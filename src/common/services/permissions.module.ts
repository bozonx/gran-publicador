import { Global, Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service.js';
import { ApiTokenScopeService } from './api-token-scope.service.js';

/**
 * Global module providing permissions checking service
 * Available across all modules without explicit import
 */
@Global()
@Module({
  providers: [PermissionsService, ApiTokenScopeService],
  exports: [PermissionsService, ApiTokenScopeService],
})
export class PermissionsModule {}
