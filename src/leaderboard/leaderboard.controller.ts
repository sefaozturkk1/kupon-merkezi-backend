import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LeaderboardService } from './leaderboard.service';

@ApiTags('leaderboard')
@Controller('leaderboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get('coupons')
  @ApiOperation({ summary: 'En çok oynanan kuponlar' })
  async getMostPlayedCoupons(
    @Query('period') period: 'daily' | 'weekly' | 'monthly' = 'weekly',
    @Query('communityId') communityId?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.leaderboardService.getMostPlayedCoupons(period, communityId, page, limit);
  }

  @Get('users')
  @ApiOperation({ summary: 'En başarılı kullanıcılar' })
  async getTopUsers(
    @Query('period') period: 'daily' | 'weekly' | 'monthly' = 'weekly',
    @Query('communityId') communityId?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.leaderboardService.getTopUsers(period, communityId, page, limit);
  }
}
