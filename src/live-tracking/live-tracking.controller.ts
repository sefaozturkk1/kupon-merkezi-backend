import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LiveTrackingService } from './live-tracking.service';

@ApiTags('live')
@Controller('live')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LiveTrackingController {
  constructor(private readonly liveTrackingService: LiveTrackingService) {}

  @Get('matches')
  @ApiOperation({ summary: 'Canlı maçları getir' })
  async getLiveMatches() {
    return this.liveTrackingService.getLiveMatches();
  }

  @Post('update')
  @ApiOperation({ summary: 'Kupon durumlarını güncelle (cron tetiklenebilir)' })
  async updateSelections() {
    await this.liveTrackingService.updateCouponSelections();
    return { message: 'Güncelleme tamamlandı' };
  }
}
