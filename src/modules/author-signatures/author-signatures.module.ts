import { Module } from '@nestjs/common';
import { AuthorSignaturesService } from './author-signatures.service.js';
import { AuthorSignaturesController } from './author-signatures.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ApiTokensModule } from '../api-tokens/api-tokens.module.js';
import { UsersModule } from '../users/users.module.js';

@Module({
  imports: [PrismaModule, ApiTokensModule, UsersModule],
  controllers: [AuthorSignaturesController],
  providers: [AuthorSignaturesService],
  exports: [AuthorSignaturesService],
})
export class AuthorSignaturesModule {}
