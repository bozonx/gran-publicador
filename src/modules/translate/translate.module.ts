import { Module } from '@nestjs/common';
import { TranslateController } from './translate.controller.js';
import { TranslateService } from './translate.service.js';

/**
 * Module for translation functionality.
 */
@Module({
  controllers: [TranslateController],
  providers: [TranslateService],
  exports: [TranslateService],
})
export class TranslateModule {}
