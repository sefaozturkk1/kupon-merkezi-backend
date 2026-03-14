import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LiveTrackingService {
  private apiKey: string;
  private apiHost: string;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>('API_FOOTBALL_KEY') || '';
    this.apiHost = this.configService.get<string>('API_FOOTBALL_HOST') || 'v3.football.api-sports.io';
  }

  // Canlı maçları getir
  async getLiveMatches() {
    try {
      const response = await axios.get(
        `https://${this.apiHost}/fixtures?live=all`,
        {
          headers: {
            'x-apisports-key': this.apiKey,
          },
        },
      );
      return response.data.response || [];
    } catch (error) {
      console.error('Live matches fetch error:', error.message);
      return [];
    }
  }

  // Maç detayı getir
  async getMatchDetails(matchId: string) {
    try {
      const response = await axios.get(
        `https://${this.apiHost}/fixtures?id=${matchId}`,
        {
          headers: {
            'x-apisports-key': this.apiKey,
          },
        },
      );
      return response.data.response?.[0] || null;
    } catch (error) {
      console.error('Match details fetch error:', error.message);
      return null;
    }
  }

  // Kuponlardaki maçları güncelle
  async updateCouponSelections() {
    // Pending veya Live olan kuponların seçimlerini bul
    const activeSelections = await this.prisma.couponSelection.findMany({
      where: {
        matchId: { not: null },
        status: { in: ['PENDING', 'WINNING', 'LOSING'] },
      },
    });

    if (activeSelections.length === 0) return;

    // Benzersiz match ID'leri topla
    const matchIds = [...new Set(activeSelections.filter(s => s.matchId).map(s => s.matchId!))];

    for (const matchId of matchIds) {
      const match = await this.getMatchDetails(matchId);
      if (!match) continue;

      const selectionsForMatch = activeSelections.filter(s => s.matchId === matchId);

      for (const selection of selectionsForMatch) {
        const newStatus = this.evaluateSelection(
          selection,
          match,
        );

        const matchStatus = this.mapMatchStatus(match.fixture.status.short);

        await this.prisma.couponSelection.update({
          where: { id: selection.id },
          data: {
            status: newStatus as any,
            homeScore: match.goals.home,
            awayScore: match.goals.away,
            matchStatus: matchStatus as any,
          },
        });
      }
    }

    // Kupon durumlarını güncelle
    await this.updateCouponStatuses();
  }

  // Tahmin değerlendirme
  private evaluateSelection(selection: any, match: any): string {
    const homeScore = match.goals.home ?? 0;
    const awayScore = match.goals.away ?? 0;
    const isFinished = match.fixture.status.short === 'FT';
    const totalGoals = homeScore + awayScore;

    let isWinning = false;

    switch (selection.betType.toLowerCase()) {
      case 'maç sonucu':
      case 'match result':
      case '1x2':
        if (selection.prediction === '1') isWinning = homeScore > awayScore;
        else if (selection.prediction === 'X' || selection.prediction === 'x') isWinning = homeScore === awayScore;
        else if (selection.prediction === '2') isWinning = awayScore > homeScore;
        break;

      case 'alt/üst 2.5':
      case 'over/under 2.5':
        if (selection.prediction.toLowerCase().includes('üst') || selection.prediction.toLowerCase().includes('over'))
          isWinning = totalGoals > 2.5;
        else
          isWinning = totalGoals < 2.5;
        break;

      case 'karşılıklı gol':
      case 'both teams to score':
        if (selection.prediction.toLowerCase() === 'var' || selection.prediction.toLowerCase() === 'yes')
          isWinning = homeScore > 0 && awayScore > 0;
        else
          isWinning = homeScore === 0 || awayScore === 0;
        break;

      default:
        // Bilinmeyen bahis tipi - durumu değiştirme
        return selection.status;
    }

    if (isFinished) {
      return isWinning ? 'WON' : 'LOST';
    }
    return isWinning ? 'WINNING' : 'LOSING';
  }

  // API-Football durum kodlarını eşleştir
  private mapMatchStatus(apiStatus: string): string {
    const statusMap: Record<string, string> = {
      'NS': 'NOT_STARTED',
      'TBD': 'NOT_STARTED',
      '1H': 'FIRST_HALF',
      'HT': 'HALF_TIME',
      '2H': 'SECOND_HALF',
      'ET': 'EXTRA_TIME',
      'P': 'PENALTIES',
      'FT': 'FINISHED',
      'AET': 'FINISHED',
      'PEN': 'FINISHED',
      'PST': 'POSTPONED',
      'CANC': 'CANCELLED',
      'SUSP': 'SUSPENDED',
      'INT': 'INTERRUPTED',
    };
    return statusMap[apiStatus] || 'NOT_STARTED';
  }

  // Kupon genel durumunu güncelle
  private async updateCouponStatuses() {
    // Aktif kuponları al
    const activeCoupons = await this.prisma.coupon.findMany({
      where: { status: { in: ['PENDING', 'LIVE', 'PARTIAL'] } },
      include: { selections: true },
    });

    for (const coupon of activeCoupons) {
      const allWon = coupon.selections.every(s => s.status === 'WON');
      const anyLost = coupon.selections.some(s => s.status === 'LOST');
      const anyLive = coupon.selections.some(s => ['WINNING', 'LOSING'].includes(s.status));
      const allSettled = coupon.selections.every(s => ['WON', 'LOST', 'VOID'].includes(s.status));

      let newStatus: string;

      if (anyLost && allSettled) {
        newStatus = 'LOST';
      } else if (allWon) {
        newStatus = 'WON';
      } else if (anyLive) {
        newStatus = 'LIVE';
      } else if (anyLost && !allSettled) {
        newStatus = 'LOST'; // Bir tane bile yatarsa kupon yatar
      } else {
        newStatus = 'PENDING';
      }

      await this.prisma.coupon.update({
        where: { id: coupon.id },
        data: {
          status: newStatus as any,
          ...(allSettled ? { settledAt: new Date() } : {}),
        },
      });
    }
  }
}
