import { Module } from '@nestjs/common';
import { RolesService } from './roles.service.js';
import { RolesController } from './roles.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ApiTokensModule } from '../api-tokens/api-tokens.module.js';
import { JwtOrApiTokenGuard } from '../../common/guards/jwt-or-api-token.guard.js';

@Module({
  imports: [PrismaModule, ApiTokensModule],
  controllers: [RolesController],
  providers: [RolesService, JwtOrApiTokenGuard],
  exports: [RolesService],
})
export class RolesModule {}
