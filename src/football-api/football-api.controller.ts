import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { FootballApiService } from './football-api.service';

@ApiTags('football')
@Controller('football')
export class FootballApiController {
  constructor(private readonly footballApi: FootballApiService) {}

  @Get('today')
  @ApiOperation({ summary: 'Bugünün maçları (canlılar dahil)' })
  async getTodayMatches() {
    return this.footballApi.getTodayMatches();
  }

  @Get('live')
  @ApiOperation({ summary: 'Şu an canlı oynanan maçlar' })
  async getLiveMatches() {
    return this.footballApi.getLiveMatches();
  }

  @Get('search-team')
  @ApiOperation({ summary: 'Takım ara' })
  @ApiQuery({ name: 'q', description: 'Takım adı', example: 'Real Madrid' })
  async searchTeam(@Query('q') query: string) {
    return this.footballApi.searchTeam(query);
  }

  @Get('team-upcoming')
  @ApiOperation({ summary: 'Takımın yaklaşan maçları' })
  @ApiQuery({ name: 'teamId', example: 86 })
  async getTeamUpcoming(@Query('teamId') teamId: number) {
    return this.footballApi.getTeamMatches(teamId, 'SCHEDULED');
  }

  @Get('team-finished')
  @ApiOperation({ summary: 'Takımın son oynanan maçları' })
  @ApiQuery({ name: 'teamId', example: 86 })
  async getTeamFinished(@Query('teamId') teamId: number) {
    return this.footballApi.getTeamFinishedMatches(teamId);
  }

  @Get('match')
  @ApiOperation({ summary: 'Maç detayı (skor, durum)' })
  @ApiQuery({ name: 'id', description: 'Match ID' })
  async getMatch(@Query('id') id: number) {
    return this.footballApi.getMatchById(id);
  }

  @Get('competition')
  @ApiOperation({ summary: 'Lig maçları' })
  @ApiQuery({ name: 'code', example: 'PL', description: 'Lig kodu (PL, PD, BL1, SA, FL1)' })
  @ApiQuery({ name: 'matchday', required: false, description: 'Hafta numarası' })
  async getCompetitionMatches(
    @Query('code') code: string,
    @Query('matchday') matchday?: number,
  ) {
    return this.footballApi.getCompetitionMatches(code, matchday);
  }

  @Get('standings')
  @ApiOperation({ summary: 'Lig puan durumu' })
  @ApiQuery({ name: 'code', example: 'PL' })
  async getStandings(@Query('code') code: string) {
    return this.footballApi.getStandings(code);
  }
}
