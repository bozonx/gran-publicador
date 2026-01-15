import { Module } from '@nestjs/common';
import { LlmPromptTemplatesService } from './llm-prompt-templates.service.js';
import { LlmPromptTemplatesController } from './llm-prompt-templates.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [LlmPromptTemplatesController],
  providers: [LlmPromptTemplatesService],
  exports: [LlmPromptTemplatesService],
})
export class LlmPromptTemplatesModule {}
