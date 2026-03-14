import { Module } from '@nestjs/common';
import { CouponController } from './coupon.controller';
import { CouponService } from './coupon.service';
import { AiOcrModule } from '../ai-ocr/ai-ocr.module';

@Module({
  imports: [AiOcrModule],
  controllers: [CouponController],
  providers: [CouponService],
  exports: [CouponService],
})
export class CouponModule {}
