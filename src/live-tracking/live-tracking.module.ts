import { Module } from '@nestjs/common';
import { LiveTrackingController } from './live-tracking.controller';
import { LiveTrackingService } from './live-tracking.service';
import { GatewayModule } from '../gateway/gateway.module';

@Module({
  imports: [GatewayModule],
  controllers: [LiveTrackingController],
  providers: [LiveTrackingService],
  exports: [LiveTrackingService],
})
export class LiveTrackingModule {}
