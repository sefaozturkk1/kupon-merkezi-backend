import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class FootballApiService {
  private apiKey: string;
  private baseUrl = 'https://api.football-data.org/v4';

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('FOOTBALL_DATA_KEY') || '';
  }

  private async request(endpoint: string, params: Record<string, any> = {}) {
    try {
      const response = await axios.get(`${this.baseUrl}/${endpoint}`, {
        params,
        headers: {
          'X-Auth-Token': this.apiKey,
        },
      });
      return response.data;
    } catch (error: any) {
      console.error('Football API Error:', error.response?.data || error.message);
      throw error;
    }
  }

  // ============================================
  // Bugünün tüm maçları (canlı dahil)
  // ============================================
  async getTodayMatches() {
    const data = await this.request('matches');
    return (data.matches || []).map((m: any) => this.formatMatch(m));
  }

  // ============================================
  // Canlı maçlar (şu an devam eden)
  // ============================================
  async getLiveMatches() {
    const data = await this.request('matches', { status: 'LIVE' });
    return (data.matches || []).map((m: any) => this.formatMatch(m));
  }

  // In-memory cache for teams
  private static cachedTeams: any[] = [];
  private static isTeamsCached = false;

  // ============================================
  // Takım arama (isimle)
  // ============================================
  async searchTeam(query: string) {
    // football-data.org'da free tier limitli (dk'da 10 istek). 
    // Tüm popüler liglerdeki takımları ilk aramada önbelleğe (cache) alıyoruz.
    if (!FootballApiService.isTeamsCached) {
      const competitions = ['PL', 'PD', 'BL1', 'SA', 'FL1', 'DED', 'BSA'];
      const allTeams: any[] = [];
      const now = Date.now();
      
      for (const comp of competitions) {
        try {
          const data = await this.request(`competitions/${comp}/teams`);
          const teams = (data.teams || []).map((t: any) => ({
            id: t.id,
            name: t.name,
            shortName: t.shortName,
            tla: t.tla,
            crest: t.crest,
            competition: comp,
          }));
          allTeams.push(...teams);
        } catch (e) {
          console.error(`Cache için lig çekilemedi: ${comp}`, e?.response?.data || e.message);
        }
      }
      
      // Tekrarları temizle
      FootballApiService.cachedTeams = allTeams.filter((team, index, self) =>
        index === self.findIndex((t) => t.id === team.id)
      );
      FootballApiService.isTeamsCached = FootballApiService.cachedTeams.length > 0;
    }

    const q = query.toLowerCase();

    // Süper Lig Demo Takımlar (API'de olmadığı için özel ekleniyor)
    const mockTeams = [
      { id: 9991, name: "Galatasaray", shortName: "Galatasaray", tla: "GS", crest: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Galatasaray_Sports_Club_Logo.png/1200px-Galatasaray_Sports_Club_Logo.png", competition: "Süper Lig" },
      { id: 9992, name: "Fenerbahçe", shortName: "Fenerbahçe", tla: "FB", crest: "https://upload.wikimedia.org/wikipedia/tr/8/86/Fenerbah%C3%A7e_SK.png", competition: "Süper Lig" },
      { id: 9993, name: "Beşiktaş", shortName: "Beşiktaş", tla: "BJK", crest: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Besiktas_JK_Logo_2017.svg/1024px-Besiktas_JK_Logo_2017.svg.png", competition: "Süper Lig" },
      { id: 9994, name: "Trabzonspor", shortName: "Trabzonspor", tla: "TS", crest: "https://upload.wikimedia.org/wikipedia/tr/thumb/a/ab/TrabzonsporAmblemi.png/1200px-TrabzonsporAmblemi.png", competition: "Süper Lig" }
    ];
    
    const filteredMocks = mockTeams.filter(t => t.name.toLowerCase().includes(q) || t.tla.toLowerCase() === q);

    const unique = FootballApiService.cachedTeams.filter((t: any) => 
      t.name.toLowerCase().includes(q) || 
      t.shortName?.toLowerCase().includes(q) ||
      t.tla?.toLowerCase() === q
    );

    return [...filteredMocks, ...unique].slice(0, 10);
  }

  // ============================================
  // Takımın yaklaşan maçları
  // ============================================
  async getTeamMatches(teamId: number, status: string = 'SCHEDULED') {
    // Özel Süper Lig Takımları için Özel Maçlar
    if (teamId >= 9991 && teamId <= 9994) {
      const teamMap: Record<number, string> = { 9991: 'Galatasaray', 9992: 'Fenerbahçe', 9993: 'Beşiktaş', 9994: 'Trabzonspor' };
      const opponents: Record<number, string[]> = {
        9991: ['Fenerbahçe', 'Başakşehir', 'Sivasspor', 'Alanyaspor', 'Göztepe'],
        9992: ['Pendikspor', 'Samsunspor', 'Galatasaray', 'Kasımpaşa', 'Çaykur Rizespor'],
        9993: ['MKE Ankaragücü', 'Kayserispor', 'Fenerbahçe', 'Antalyaspor', 'Konyaspor'],
        9994: ['Çaykur Rizespor', 'Alanyaspor', 'Hatayspor', 'Galatasaray', 'Sivasspor'],
      };
      
      const teamName = teamMap[teamId] || 'Ev Sahibi';
      const opps = opponents[teamId] || ['Rakip 1', 'Rakip 2', 'Rakip 3', 'Rakip 4', 'Rakip 5'];

      return [
        { matchId: teamId * 10 + 1, date: new Date().toISOString(), status: 'IN_PLAY', competition: {name: 'Trendyol Süper Lig'}, homeTeam: {name: teamName, shortName: teamName}, awayTeam: {name: opps[0], shortName: opps[0]}, score: { homeFullTime: 2, awayFullTime: 1} },
        { matchId: teamId * 10 + 2, date: new Date(Date.now() + 86400000).toISOString(), status: 'SCHEDULED', competition: {name: 'Trendyol Süper Lig'}, homeTeam: {name: opps[1], shortName: opps[1]}, awayTeam: {name: teamName, shortName: teamName} },
        { matchId: teamId * 10 + 3, date: new Date(Date.now() + 86400000 * 7).toISOString(), status: 'SCHEDULED', competition: {name: 'Trendyol Süper Lig'}, homeTeam: {name: teamName, shortName: teamName}, awayTeam: {name: opps[2], shortName: opps[2]} },
        { matchId: teamId * 10 + 4, date: new Date(Date.now() + 86400000 * 14).toISOString(), status: 'SCHEDULED', competition: {name: 'Trendyol Süper Lig'}, homeTeam: {name: opps[3], shortName: opps[3]}, awayTeam: {name: teamName, shortName: teamName} },
        { matchId: teamId * 10 + 5, date: new Date(Date.now() + 86400000 * 21).toISOString(), status: 'SCHEDULED', competition: {name: 'Trendyol Süper Lig'}, homeTeam: {name: teamName, shortName: teamName}, awayTeam: {name: opps[4], shortName: opps[4]} },
      ];
    }

    const data = await this.request(`teams/${teamId}/matches`, {
      status,
      limit: 10,
    });
    return (data.matches || []).map((m: any) => this.formatMatch(m));
  }

  // ============================================
  // Takımın son oynanan maçları
  // ============================================
  async getTeamFinishedMatches(teamId: number) {
    if (teamId === 9991 || teamId === 9992 || teamId === 9993 || teamId === 9994) {
      return [];
    }
    const data = await this.request(`teams/${teamId}/matches`, {
      status: 'FINISHED',
      limit: 5,
    });
    return (data.matches || []).map((m: any) => this.formatMatch(m));
  }

  // ============================================
  // Belirli bir maçın detayı
  // ============================================
  async getMatchById(matchId: number) {
    const data = await this.request(`matches/${matchId}`);
    return this.formatMatch(data);
  }

  // ============================================
  // Belirli bir ligin maçları
  // ============================================
  async getCompetitionMatches(competitionCode: string, matchday?: number) {
    const params: any = {};
    if (matchday) params.matchday = matchday;
    const data = await this.request(`competitions/${competitionCode}/matches`, params);
    return (data.matches || []).map((m: any) => this.formatMatch(m));
  }

  // ============================================
  // Lig puan durumu
  // ============================================
  async getStandings(competitionCode: string) {
    const data = await this.request(`competitions/${competitionCode}/standings`);
    return data.standings;
  }

  // ============================================
  // Maç Formatlama
  // ============================================
  private formatMatch(m: any) {
    return {
      matchId: m.id,
      date: m.utcDate,
      status: m.status, // SCHEDULED, TIMED, IN_PLAY, PAUSED, FINISHED, etc.
      matchday: m.matchday,
      stage: m.stage,
      competition: {
        id: m.competition?.id,
        name: m.competition?.name,
        code: m.competition?.code,
        emblem: m.competition?.emblem,
      },
      homeTeam: {
        id: m.homeTeam?.id,
        name: m.homeTeam?.name,
        shortName: m.homeTeam?.shortName,
        tla: m.homeTeam?.tla,
        crest: m.homeTeam?.crest,
      },
      awayTeam: {
        id: m.awayTeam?.id,
        name: m.awayTeam?.name,
        shortName: m.awayTeam?.shortName,
        tla: m.awayTeam?.tla,
        crest: m.awayTeam?.crest,
      },
      score: {
        winner: m.score?.winner,
        homeFullTime: m.score?.fullTime?.home,
        awayFullTime: m.score?.fullTime?.away,
        homeHalfTime: m.score?.halfTime?.home,
        awayHalfTime: m.score?.halfTime?.away,
      },
      lastUpdated: m.lastUpdated,
    };
  }

  // ============================================
  // Ücretsiz erişilebilir lig kodları
  // ============================================
  static readonly COMPETITIONS = {
    PREMIER_LEAGUE: 'PL',     // İngiltere
    LA_LIGA: 'PD',            // İspanya
    BUNDESLIGA: 'BL1',        // Almanya
    SERIE_A: 'SA',            // İtalya
    LIGUE_1: 'FL1',           // Fransa
    EREDIVISIE: 'DED',        // Hollanda
    BRASILEIRAO: 'BSA',       // Brezilya
    CHAMPIONSHIP: 'ELC',      // İngiltere 2. Lig
    CHAMPIONS_LEAGUE: 'CL',   // Şampiyonlar Ligi
    COPA_LIBERTADORES: 'CLI', // Copa Libertadores
  };
}
