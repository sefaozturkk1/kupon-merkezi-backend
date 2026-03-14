import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StatisticsService } from './statistics.service';

@ApiTags('statistics')
@Controller('statistics')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get()
  @ApiOperation({ summary: 'Kullanıcı istatistikleri' })
  async getMyStats(
    @Request() req: any,
    @Query('period') period: 'daily' | 'monthly' | 'yearly' | 'all' = 'all',
  ) {
    return this.statisticsService.getUserStats(req.user.sub, period);
  }

  @Get(':userId')
  @ApiOperation({ summary: 'Belirli kullanıcının istatistikleri' })
  async getUserStats(
    @Query('userId') userId: string,
    @Query('period') period: 'daily' | 'monthly' | 'yearly' | 'all' = 'all',
  ) {
    return this.statisticsService.getUserStats(userId, period);
  }
}
