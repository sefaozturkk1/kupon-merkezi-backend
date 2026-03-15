import { Controller, Get, Query, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { StatisticsService } from './statistics.service';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('statistics')
@Controller('statistics')
export class StatisticsController {
  constructor(
    private readonly statisticsService: StatisticsService,
    private readonly prisma: PrismaService,
  ) {}

  private async getFallbackUserId(reqInfo: any): Promise<string> {
    if (reqInfo?.user?.sub) return reqInfo.user.sub;
    const user = await this.prisma.user.findFirst();
    return user?.id || '';
  }

  @Get()
  @ApiOperation({ summary: 'Kullanıcı istatistikleri' })
  @ApiQuery({ name: 'period', required: false, enum: ['daily', 'monthly', 'yearly', 'all'] })
  async getMyStats(
    @Request() req: any,
    @Query('period') period: 'daily' | 'monthly' | 'yearly' | 'all' = 'all',
  ) {
    const userId = await this.getFallbackUserId(req);
    return this.statisticsService.getUserStats(userId, period);
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
