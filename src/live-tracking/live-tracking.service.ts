import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { LiveGateway } from '../gateway/live.gateway';

@Injectable()
export class LiveTrackingService implements OnModuleInit {
  private apiKey: string;
  private apiHost: string;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private liveGateway: LiveGateway,
  ) {
    this.apiKey = this.configService.get<string>('API_FOOTBALL_KEY') || '';
    this.apiHost = this.configService.get<string>('API_FOOTBALL_HOST') || 'v3.football.api-sports.io';
  }

  // Uygulama başladığında otomatik güncelleme döngüsünü başlat
  onModuleInit() {
    console.log('🔄 Canlı kupon takip sistemi başlatılıyor...');
    // Her 60 saniyede kupon durumlarını güncelle
    this.updateInterval = setInterval(() => {
      this.updateCouponSelections().catch(err => {
        console.error('Kupon güncelleme hatası:', err.message);
      });
    }, 60_000); // 60 saniye

    // İlk başlatmada 5 saniye sonra bir güncelleme yap
    setTimeout(() => {
      this.updateCouponSelections().catch(() => {});
    }, 5000);
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
      include: {
        coupon: {
          include: {
            user: true,
          },
        },
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
        const oldStatus = selection.status;
        const oldHomeScore = selection.homeScore;
        const oldAwayScore = selection.awayScore;

        const newStatus = this.evaluateSelection(selection, match);
        const matchStatus = this.mapMatchStatus(match.fixture.status.short);
        const newHomeScore = match.goals.home;
        const newAwayScore = match.goals.away;

        await this.prisma.couponSelection.update({
          where: { id: selection.id },
          data: {
            status: newStatus as any,
            homeScore: newHomeScore,
            awayScore: newAwayScore,
            matchStatus: matchStatus as any,
          },
        });

        // 🔔 GOL BİLDİRİMİ: Skor değiştiyse WebSocket ile bildir
        const totalOld = (oldHomeScore ?? 0) + (oldAwayScore ?? 0);
        const totalNew = (newHomeScore ?? 0) + (newAwayScore ?? 0);

        if (totalNew > totalOld) {
          const goalTeam = newHomeScore > (oldHomeScore ?? 0)
            ? selection.homeTeam
            : selection.awayTeam;

          // WebSocket ile gol bildirimi gönder
          this.liveGateway.emitCouponUpdate(selection.couponId, {
            type: 'GOAL',
            matchId: selection.matchId,
            homeTeam: selection.homeTeam,
            awayTeam: selection.awayTeam,
            homeScore: newHomeScore,
            awayScore: newAwayScore,
            goalTeam,
            selectionStatus: newStatus,
            message: `⚽ GOL! ${goalTeam} - ${selection.homeTeam} ${newHomeScore}-${newAwayScore} ${selection.awayTeam}`,
          });

          console.log(`⚽ GOL: ${selection.homeTeam} ${newHomeScore}-${newAwayScore} ${selection.awayTeam} | Kupon: ${selection.couponId}`);
        }

        // 🔔 TAHMİN DURUM DEĞİŞİKLİĞİ
        if (oldStatus !== newStatus) {
          this.liveGateway.emitCouponUpdate(selection.couponId, {
            type: 'SELECTION_UPDATE',
            matchId: selection.matchId,
            homeTeam: selection.homeTeam,
            awayTeam: selection.awayTeam,
            oldStatus,
            newStatus,
            prediction: selection.prediction,
            betType: selection.betType,
          });
        }
      }
    }

    // Kupon durumlarını güncelle ve bildirimleri gönder
    await this.updateCouponStatuses();
  }

  // Tahmin değerlendirme
  private evaluateSelection(selection: any, match: any): string {
    const homeScore = match.goals.home ?? 0;
    const awayScore = match.goals.away ?? 0;
    const isFinished = ['FT', 'AET', 'PEN'].includes(match.fixture.status.short);
    const totalGoals = homeScore + awayScore;

    let isWinning = false;

    // Bahis tipini normalize et
    const betType = selection.betType.toLowerCase().trim();

    // --- MAÇ SONUCU (1X2) ---
    if (betType.includes('maç sonucu') || betType.includes('1x2') || betType === 'match result') {
      if (selection.prediction === '1') isWinning = homeScore > awayScore;
      else if (selection.prediction === 'X' || selection.prediction === 'x') isWinning = homeScore === awayScore;
      else if (selection.prediction === '2') isWinning = awayScore > homeScore;
    }
    // --- ÇİFTE ŞANS ---
    else if (betType.includes('çifte şans')) {
      if (selection.prediction === '1-X') isWinning = homeScore >= awayScore;
      else if (selection.prediction === '1-2') isWinning = homeScore !== awayScore;
      else if (selection.prediction === 'X-2') isWinning = awayScore >= homeScore;
    }
    // --- ALT/ÜST ---
    else if (betType.includes('alt/üst')) {
      const threshold = parseFloat(betType.match(/[\d.]+/)?.[0] || '2.5');
      const pred = selection.prediction.toLowerCase();
      if (pred.includes('üst') || pred.includes('over')) isWinning = totalGoals > threshold;
      else isWinning = totalGoals < threshold;
    }
    // --- KARŞILIKLI GOL ---
    else if (betType.includes('karşılıklı gol') || betType.includes('kg')) {
      const pred = selection.prediction.toLowerCase();
      if (pred === 'var' || pred === 'yes') isWinning = homeScore > 0 && awayScore > 0;
      else isWinning = homeScore === 0 || awayScore === 0;
    }
    // --- TEK/ÇİFT GOL ---
    else if (betType.includes('tek/çift')) {
      if (selection.prediction.toLowerCase() === 'tek') isWinning = totalGoals % 2 !== 0;
      else isWinning = totalGoals % 2 === 0;
    }
    // --- İLK YARI SONUCU ---
    else if (betType.includes('ilk yarı sonucu')) {
      const htHome = match.score?.halftime?.home ?? 0;
      const htAway = match.score?.halftime?.away ?? 0;
      if (selection.prediction === '1') isWinning = htHome > htAway;
      else if (selection.prediction === 'X' || selection.prediction === 'x') isWinning = htHome === htAway;
      else if (selection.prediction === '2') isWinning = htAway > htHome;
    }
    // --- BİLİNMEYEN ---
    else {
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

  // Kupon genel durumunu güncelle + bildirim gönder
  private async updateCouponStatuses() {
    // Aktif kuponları al
    const activeCoupons = await this.prisma.coupon.findMany({
      where: { status: { in: ['PENDING', 'LIVE', 'PARTIAL'] } },
      include: {
        selections: true,
        user: true,
      },
    });

    for (const coupon of activeCoupons) {
      const oldStatus = coupon.status;
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

      // 🔔 KUPON DURUM DEĞİŞİKLİĞİ BİLDİRİMİ
      if (oldStatus !== newStatus) {
        if (newStatus === 'WON') {
          // 🎉 Kupon kazandı!
          this.liveGateway.emitCouponUpdate(coupon.id, {
            type: 'COUPON_WON',
            couponId: coupon.id,
            title: coupon.title,
            totalOdds: coupon.totalOdds,
            potentialWin: coupon.potentialWin,
            message: `🎉 "${coupon.title}" kuponu KAZANDI! Potansiyel Kazanç: ${coupon.potentialWin} ₺`,
          });

          // Genel akışa da bildir
          this.liveGateway.emitFeedUpdate({
            type: 'COUPON_WON',
            couponId: coupon.id,
            title: coupon.title,
            userName: coupon.user?.username || coupon.user?.firstName || 'Kullanıcı',
          });

          console.log(`🎉 KUPON KAZANDI: "${coupon.title}" | Kazanç: ${coupon.potentialWin} ₺`);
        } else if (newStatus === 'LOST') {
          // ❌ Kupon kaybetti
          this.liveGateway.emitCouponUpdate(coupon.id, {
            type: 'COUPON_LOST',
            couponId: coupon.id,
            title: coupon.title,
            message: `❌ "${coupon.title}" kuponu kaybetti.`,
          });

          console.log(`❌ KUPON KAYBETTİ: "${coupon.title}"`);
        } else if (newStatus === 'LIVE' && oldStatus === 'PENDING') {
          // 🔴 Kupon canlıya geçti
          this.liveGateway.emitCouponUpdate(coupon.id, {
            type: 'COUPON_LIVE',
            couponId: coupon.id,
            title: coupon.title,
            message: `🔴 "${coupon.title}" kuponu CANLI! Maçlar başladı.`,
          });

          console.log(`🔴 KUPON CANLI: "${coupon.title}"`);
        }
      }
    }
  }
}
