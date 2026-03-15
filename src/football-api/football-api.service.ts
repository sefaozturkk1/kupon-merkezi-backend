import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class FootballApiService {
  private apiKey: string;
  private apiHost: string;
  private baseUrl: string;

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('API_FOOTBALL_KEY') || '';
    this.apiHost = this.configService.get<string>('API_FOOTBALL_HOST') || 'v3.football.api-sports.io';
    this.baseUrl = `https://${this.apiHost}`;
  }

  private async request(endpoint: string, params: Record<string, any> = {}) {
    try {
      const response = await axios.get(`${this.baseUrl}/${endpoint}`, {
        params,
        headers: {
          'x-apisports-key': this.apiKey,
        },
      });
      return response.data;
    } catch (error: any) {
      console.error('API-Football Error:', error.response?.data || error.message);
      throw error;
    }
  }

  // ============================================
  // Bugünün tüm maçları
  // ============================================
  async getTodayMatches() {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const data = await this.request('fixtures', { date: today });
    return (data.response || []).map((item: any) => this.formatMatch(item));
  }

  // ============================================
  // Canlı maçlar (şu an devam eden)
  // ============================================
  async getLiveMatches() {
    const data = await this.request('fixtures', { live: 'all' });
    return (data.response || []).map((item: any) => this.formatMatch(item));
  }

  // ============================================
  // Takım Arama
  // ============================================
  async searchTeam(query: string) {
    const data = await this.request('teams', { search: query });
    return (data.response || []).map((item: any) => ({
      id: item.team.id,
      name: item.team.name,
      shortName: item.team.code || item.team.name,
      tla: item.team.code,
      crest: item.team.logo,
      country: item.venue?.city || item.team.country,
      competition: item.team.country,
    })).slice(0, 10);
  }

  // ============================================
  // Takımın yaklaşan maçları
  // ============================================
  async getTeamMatches(teamId: number, status: string = 'SCHEDULED') {
    let data: any;

    if (status === 'SCHEDULED') {
      // Yaklaşan maçlar
      data = await this.request('fixtures', { team: teamId, next: 10 });
    } else {
      // Geçmiş maçlar
      data = await this.request('fixtures', { team: teamId, last: 5 });
    }

    return (data.response || []).map((item: any) => this.formatMatch(item));
  }

  // ============================================
  // Takımın son oynanan maçları
  // ============================================
  async getTeamFinishedMatches(teamId: number) {
    const data = await this.request('fixtures', { team: teamId, last: 5 });
    return (data.response || []).map((item: any) => this.formatMatch(item));
  }

  // ============================================
  // Belirli bir maçın detayı
  // ============================================
  async getMatchById(matchId: number) {
    const data = await this.request('fixtures', { id: matchId });
    if (data.response && data.response.length > 0) {
      return this.formatMatch(data.response[0]);
    }
    return null;
  }

  // ============================================
  // Belirli bir ligin maçları
  // ============================================
  async getCompetitionMatches(leagueId: string, round?: number) {
    const currentYear = new Date().getFullYear();
    // Sezon genellikle Ağustos'ta başlar, Temmuz öncesi önceki sezon
    const season = new Date().getMonth() >= 6 ? currentYear : currentYear - 1;

    const params: any = { league: leagueId, season };
    if (round) params.round = `Regular Season - ${round}`;

    const data = await this.request('fixtures', params);
    return (data.response || []).map((item: any) => this.formatMatch(item));
  }

  // ============================================
  // Lig puan durumu
  // ============================================
  async getStandings(leagueId: string) {
    const currentYear = new Date().getFullYear();
    const season = new Date().getMonth() >= 6 ? currentYear : currentYear - 1;

    const data = await this.request('standings', { league: leagueId, season });
    if (data.response && data.response.length > 0) {
      return data.response[0].league.standings;
    }
    return [];
  }

  // ============================================
  // Popüler ligler listesi
  // ============================================
  async getPopularLeagues() {
    const leagueIds = Object.values(FootballApiService.LEAGUES);
    return leagueIds.map((id) => {
      const entry = Object.entries(FootballApiService.LEAGUES).find(([_, v]) => v === id);
      return { id, name: entry ? entry[0] : 'Unknown' };
    });
  }

  // ============================================
  // Maç Formatlama (api-sports.io formatından)
  // ============================================
  private formatMatch(item: any) {
    const fixture = item.fixture || {};
    const league = item.league || {};
    const teams = item.teams || {};
    const goals = item.goals || {};
    const score = item.score || {};

    // Durum dönüştürme
    let status = 'TIMED';
    const fixtureStatus = fixture.status?.short || '';

    if (['1H', '2H', 'ET', 'P', 'BT', 'LIVE'].includes(fixtureStatus)) {
      status = 'IN_PLAY';
    } else if (fixtureStatus === 'HT') {
      status = 'PAUSED';
    } else if (['FT', 'AET', 'PEN'].includes(fixtureStatus)) {
      status = 'FINISHED';
    } else if (['NS', 'TBD'].includes(fixtureStatus)) {
      status = 'SCHEDULED';
    } else if (['PST', 'CANC', 'ABD', 'AWD', 'WO'].includes(fixtureStatus)) {
      status = 'POSTPONED';
    }

    return {
      matchId: fixture.id,
      date: fixture.date,
      status,
      minute: fixture.status?.elapsed || null,
      matchday: league.round,
      stage: league.round,
      competition: {
        id: league.id,
        name: league.name,
        code: league.country,
        emblem: league.logo,
        flag: league.flag,
      },
      homeTeam: {
        id: teams.home?.id,
        name: teams.home?.name,
        shortName: teams.home?.name,
        tla: null,
        crest: teams.home?.logo,
        winner: teams.home?.winner,
      },
      awayTeam: {
        id: teams.away?.id,
        name: teams.away?.name,
        shortName: teams.away?.name,
        tla: null,
        crest: teams.away?.logo,
        winner: teams.away?.winner,
      },
      score: {
        winner: teams.home?.winner ? 'HOME_TEAM' : teams.away?.winner ? 'AWAY_TEAM' : null,
        homeFullTime: goals.home,
        awayFullTime: goals.away,
        homeHalfTime: score.halftime?.home,
        awayHalfTime: score.halftime?.away,
      },
      lastUpdated: fixture.date,
    };
  }

  // ============================================
  // Popüler Lig ID'leri (api-sports.io)
  // ============================================
  static readonly LEAGUES: Record<string, number> = {
    'Süper Lig': 203,            // 🇹🇷 Türkiye
    'Premier League': 39,         // 🏴 İngiltere
    'La Liga': 140,               // 🇪🇸 İspanya
    'Bundesliga': 78,             // 🇩🇪 Almanya
    'Serie A': 135,               // 🇮🇹 İtalya
    'Ligue 1': 61,                // 🇫🇷 Fransa
    'Champions League': 2,        // 🏆 Şampiyonlar Ligi
    'Europa League': 3,           // 🏆 Avrupa Ligi
    'Conference League': 848,     // 🏆 Konferans Ligi
    'Eredivisie': 88,             // 🇳🇱 Hollanda
    'Primeira Liga': 94,          // 🇵🇹 Portekiz
    'Serie A (Brezilya)': 71,     // 🇧🇷 Brezilya
  };
}
