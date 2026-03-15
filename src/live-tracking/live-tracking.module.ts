import { Module } from '@nestjs/common';
import { LiveTrackingController } from './live-tracking.controller';
import { LiveTrackingService } from './live-tracking.service';
import { GatewayModule } from '../gateway/gateway.module';
import { StatisticsModule } from '../statistics/statistics.module';

@Module({
  imports: [GatewayModule, StatisticsModule],
  controllers: [LiveTrackingController],
  providers: [LiveTrackingService],
  exports: [LiveTrackingService],
})
export class LiveTrackingModule {}
