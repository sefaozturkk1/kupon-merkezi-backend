import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CouponModule } from './coupon/coupon.module';
import { CommunityModule } from './community/community.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { LiveTrackingModule } from './live-tracking/live-tracking.module';
import { StatisticsModule } from './statistics/statistics.module';
import { TelegramModule } from './telegram/telegram.module';
import { AiOcrModule } from './ai-ocr/ai-ocr.module';
import { GatewayModule } from './gateway/gateway.module';
import { FootballApiModule } from './football-api/football-api.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    CouponModule,
    CommunityModule,
    LeaderboardModule,
    LiveTrackingModule,
    StatisticsModule,
    TelegramModule,
    AiOcrModule,
    GatewayModule,
    FootballApiModule,
  ],
})
export class AppModule {}
