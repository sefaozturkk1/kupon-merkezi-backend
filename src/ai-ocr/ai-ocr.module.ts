import { Module } from '@nestjs/common';
import { AiOcrService } from './ai-ocr.service';

@Module({
  providers: [AiOcrService],
  exports: [AiOcrService],
})
export class AiOcrModule {}
