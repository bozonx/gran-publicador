import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module.js';
import { ApiTokensModule } from '../api-tokens/api-tokens.module.js';
import { ProjectTemplatesController } from './project-templates.controller.js';
import { ProjectTemplatesService } from './project-templates.service.js';

@Module({
  imports: [PrismaModule, ApiTokensModule],
  controllers: [ProjectTemplatesController],
  providers: [ProjectTemplatesService],
  exports: [ProjectTemplatesService],
})
export class ProjectTemplatesModule {}
