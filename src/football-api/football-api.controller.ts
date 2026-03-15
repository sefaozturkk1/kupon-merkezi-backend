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
  @ApiQuery({ name: 'q', description: 'Takım adı', example: 'Galatasaray' })
  async searchTeam(@Query('q') query: string) {
    return this.footballApi.searchTeam(query);
  }

  @Get('team-upcoming')
  @ApiOperation({ summary: 'Takımın yaklaşan maçları' })
  @ApiQuery({ name: 'teamId', example: 645, description: 'Galatasaray=645, Fenerbahçe=611, Beşiktaş=549, Trabzonspor=607' })
  async getTeamUpcoming(@Query('teamId') teamId: number) {
    return this.footballApi.getTeamMatches(teamId, 'SCHEDULED');
  }

  @Get('team-finished')
  @ApiOperation({ summary: 'Takımın son oynanan maçları' })
  @ApiQuery({ name: 'teamId', example: 645 })
  async getTeamFinished(@Query('teamId') teamId: number) {
    return this.footballApi.getTeamFinishedMatches(teamId);
  }

  @Get('match')
  @ApiOperation({ summary: 'Maç detayı (skor, durum)' })
  @ApiQuery({ name: 'id', description: 'Match ID (fixture ID)' })
  async getMatch(@Query('id') id: number) {
    return this.footballApi.getMatchById(id);
  }

  @Get('competition')
  @ApiOperation({ summary: 'Lig maçları' })
  @ApiQuery({ name: 'code', example: '203', description: 'Lig ID (203=Süper Lig, 39=PL, 140=La Liga, 78=Bundesliga, 135=Serie A)' })
  @ApiQuery({ name: 'matchday', required: false, description: 'Hafta numarası' })
  async getCompetitionMatches(
    @Query('code') code: string,
    @Query('matchday') matchday?: number,
  ) {
    return this.footballApi.getCompetitionMatches(code, matchday);
  }

  @Get('standings')
  @ApiOperation({ summary: 'Lig puan durumu' })
  @ApiQuery({ name: 'code', example: '203', description: 'Lig ID (203=Süper Lig)' })
  async getStandings(@Query('code') code: string) {
    return this.footballApi.getStandings(code);
  }

  @Get('leagues')
  @ApiOperation({ summary: 'Desteklenen popüler ligler' })
  async getLeagues() {
    return this.footballApi.getPopularLeagues();
  }
}
