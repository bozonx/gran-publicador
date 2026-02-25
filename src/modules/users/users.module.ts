import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from '../prisma/prisma.module.js';
import { ProfileController } from './profile.controller.js';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

/**
 * Module for user management.
 * Provides services for user retrieval and updates.
 */
@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [UsersController, ProfileController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
