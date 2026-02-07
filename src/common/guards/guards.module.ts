import { Global, Module } from '@nestjs/common';

import { ApiTokensModule } from '../../modules/api-tokens/api-tokens.module.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { JwtOrApiTokenGuard } from './jwt-or-api-token.guard.js';

@Global()
@Module({
  imports: [ApiTokensModule],
  providers: [JwtAuthGuard, JwtOrApiTokenGuard],
  exports: [JwtAuthGuard, JwtOrApiTokenGuard],
})
export class GuardsModule {}
