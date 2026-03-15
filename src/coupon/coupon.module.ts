import { Module } from '@nestjs/common';
import { CouponController } from './coupon.controller';
import { CouponService } from './coupon.service';
import { AiOcrModule } from '../ai-ocr/ai-ocr.module';
import { FootballApiModule } from '../football-api/football-api.module';

@Module({
  imports: [AiOcrModule, FootballApiModule],
  controllers: [CouponController],
  providers: [CouponService],
  exports: [CouponService],
})
export class CouponModule {}
