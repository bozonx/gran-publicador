import { Global, Module } from '@nestjs/common';

import { ApiTokensModule } from '../../modules/api-tokens/api-tokens.module.js';
import { ApiTokenGuard } from './api-token.guard.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { JwtOrApiTokenGuard } from './jwt-or-api-token.guard.js';
import { ProjectScopeGuard } from './project-scope.guard.js';

@Global()
@Module({
  imports: [ApiTokensModule],
  providers: [ApiTokenGuard, JwtAuthGuard, JwtOrApiTokenGuard, ProjectScopeGuard],
  exports: [ApiTokenGuard, JwtAuthGuard, JwtOrApiTokenGuard, ProjectScopeGuard],
})
export class GuardsModule {}
