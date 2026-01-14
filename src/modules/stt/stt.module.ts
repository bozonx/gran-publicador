import { Module } from '@nestjs/common';
import { SttController } from './stt.controller.js';
import { SttService } from './stt.service.js';

@Module({
  controllers: [SttController],
  providers: [SttService],
  exports: [SttService],
})
export class SttModule {}
