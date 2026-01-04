import { Global, Module } from '@nestjs/common';
import { PermissionsService } from './permissions.service.js';

/**
 * Global module providing permissions checking service
 * Available across all modules without explicit import
 */
@Global()
@Module({
  providers: [PermissionsService],
  exports: [PermissionsService],
})
export class PermissionsModule {}
