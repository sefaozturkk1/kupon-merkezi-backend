import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';
import { LiveGateway } from '../gateway/live.gateway';
import { StatisticsService } from '../statistics/statistics.service';

@Injectable()
export class LiveTrackingService implements OnModuleInit {
  private apiKey: string;
  private apiHost: string;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private liveGateway: LiveGateway,
    private statisticsService: StatisticsService,
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

  // Maç detayı getir (skor + istatistikler dahil)
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
      const matchData = response.data.response?.[0] || null;
      if (!matchData) return null;

      // İstatistikleri de çek (korner, kart, şut vb.)
      try {
        const statsResponse = await axios.get(
          `https://${this.apiHost}/fixtures/statistics?fixture=${matchId}`,
          {
            headers: {
              'x-apisports-key': this.apiKey,
            },
          },
        );
        matchData._statistics = this.parseStatistics(statsResponse.data.response || []);
      } catch (statsErr) {
        matchData._statistics = null;
      }

      return matchData;
    } catch (error: any) {
      console.error('Match details fetch error:', error.response?.data || error.message);
      return null;
    }
  }

  // İstatistikleri düzenli objeye çevir
  private parseStatistics(statsArray: any[]): any {
    if (!statsArray || statsArray.length < 2) return null;

    const home = statsArray[0]?.statistics || [];
    const away = statsArray[1]?.statistics || [];

    const getStat = (arr: any[], type: string): number => {
      const stat = arr.find((s: any) => s.type === type);
      return stat ? (parseInt(stat.value) || 0) : 0;
    };

    return {
      corners: { home: getStat(home, 'Corner Kicks'), away: getStat(away, 'Corner Kicks') },
      yellowCards: { home: getStat(home, 'Yellow Cards'), away: getStat(away, 'Yellow Cards') },
      redCards: { home: getStat(home, 'Red Cards'), away: getStat(away, 'Red Cards') },
      totalShots: { home: getStat(home, 'Total Shots'), away: getStat(away, 'Total Shots') },
      shotsOnTarget: { home: getStat(home, 'Shots on Goal'), away: getStat(away, 'Shots on Goal') },
      fouls: { home: getStat(home, 'Fouls'), away: getStat(away, 'Fouls') },
      offsides: { home: getStat(home, 'Offsides'), away: getStat(away, 'Offsides') },
      possession: { home: getStat(home, 'Ball Possession'), away: getStat(away, 'Ball Possession') },
    };
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
        const matchStatus = this.mapMatchStatus(match.fixture?.status?.short || 'NS');
        const newHomeScore = match.goals?.home ?? null;
        const newAwayScore = match.goals?.away ?? null;

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

  // Tahmin değerlendirme (gol + istatistik bazlı)
  private evaluateSelection(selection: any, match: any): string {
    const shortStatus = match.fixture?.status?.short || 'NS';
    
    // Maç henüz başlamamışsa PENDING kalsın!
    if (['NS', 'TBD', 'PST', 'CANC', 'ABD'].includes(shortStatus)) {
      return 'PENDING';
    }
    
    const homeScore = match.goals?.home ?? 0;
    const awayScore = match.goals?.away ?? 0;
    const isFinished = ['FT', 'AET', 'PEN'].includes(shortStatus);
    const totalGoals = homeScore + awayScore;
    const stats = match._statistics; // korner, kart vb.

    let isWinning = false;

    // Bahis tipini normalize et
    const betType = (selection.betType || '').toLowerCase().trim();
    const pred = (selection.prediction || '').toLowerCase().trim();

    // ========== GOL BAZLI BAHİSLER ==========

    // --- MAÇ SONUCU (1X2) ---
    if (betType.includes('maç sonucu') || betType.includes('1x2') || betType.includes('match result') || betType === 'ms') {
      if (pred === '1' || pred.includes('ev sahibi')) isWinning = homeScore > awayScore;
      else if (pred === 'x' || pred === '0' || pred.includes('berabere')) isWinning = homeScore === awayScore;
      else if (pred === '2' || pred.includes('deplasman')) isWinning = awayScore > homeScore;
    }
    // --- ÇİFTE ŞANS ---
    else if (betType.includes('çifte şans') || betType.includes('double chance')) {
      if (pred === '1-x' || pred === '1x' || pred === '1-0') isWinning = homeScore >= awayScore;
      else if (pred === '1-2' || pred === '12') isWinning = homeScore !== awayScore;
      else if (pred === 'x-2' || pred === 'x2' || pred === '0-2') isWinning = awayScore >= homeScore;
    }
    // --- GOL ALT/ÜST ---
    else if (betType.includes('alt/üst') || betType.includes('under/over') || betType.includes('toplam gol')) {
      // Barajı bul (Örn: "Alt/Üst 2.5" -> 2.5)
      const thresholdMatch = betType.match(/[\d.]+/);
      const threshold = thresholdMatch ? parseFloat(thresholdMatch[0]) : 2.5;
      
      if (pred.includes('üst') || pred.includes('over')) isWinning = totalGoals > threshold;
      else if (pred.includes('alt') || pred.includes('under')) isWinning = totalGoals < threshold;
      // "2-3", "4-6" gibi aralıklar için
      else if (pred.includes('-')) {
        const parts = pred.split('-');
        const min = parseInt(parts[0]);
        const max = parts[1].includes('+') ? 99 : parseInt(parts[1]);
        isWinning = totalGoals >= min && totalGoals <= max;
      }
    }
    // --- KARŞILIKLI GOL ---
    else if (betType.includes('karşılıklı gol') || betType === 'kg' || betType.includes('btts')) {
      if (pred === 'var' || pred === 'yes' || pred === 'evet' || pred === '1') isWinning = homeScore > 0 && awayScore > 0;
      else if (pred === 'yok' || pred === 'no' || pred === 'hayır' || pred === '0') isWinning = homeScore === 0 || awayScore === 0;
    }
    // --- TEK/ÇİFT GOL ---
    else if (betType.includes('tek/çift') || betType.includes('odd/even')) {
      if (pred === 'tek' || pred === 'odd') isWinning = totalGoals % 2 !== 0;
      else if (pred === 'çift' || pred === 'even') isWinning = totalGoals % 2 === 0;
    }
    // --- İLK YARI SONUCU ---
    else if (betType.includes('ilk yarı') || betType.includes('iy') || betType.includes('half time')) {
      const htHome = match.score?.halftime?.home ?? 0;
      const htAway = match.score?.halftime?.away ?? 0;
      if (pred === '1') isWinning = htHome > htAway;
      else if (pred === 'x' || pred === '0') isWinning = htHome === htAway;
      else if (pred === '2') isWinning = htAway > htHome;
    }
    // --- HANDİKAP ---
    else if (betType.includes('handikap') || betType.includes('handicap')) {
      const handicapMatch = betType.match(/[+-]?[\d.]+/);
      const handicap = handicapMatch ? parseFloat(handicapMatch[0]) : 0;
      if (pred === '1') isWinning = (homeScore + handicap) > awayScore;
      else if (pred === '2') isWinning = (awayScore + handicap) > homeScore;
    }

    // ========== İSTATİSTİK BAZLI BAHİSLER ==========
    else if (stats) {
      const totalCorners = (stats.corners?.home ?? 0) + (stats.corners?.away ?? 0);
      const totalYellowCards = (stats.yellowCards?.home ?? 0) + (stats.yellowCards?.away ?? 0);
      const totalCards = totalYellowCards + (stats.redCards?.home ?? 0) + (stats.redCards?.away ?? 0);

      if (betType.includes('korner')) {
        const thresholdMatch = betType.match(/[\d.]+/);
        const threshold = thresholdMatch ? parseFloat(thresholdMatch[0]) : 9.5;
        if (pred.includes('üst') || pred.includes('over')) isWinning = totalCorners > threshold;
        else if (pred.includes('alt') || pred.includes('under')) isWinning = totalCorners < threshold;
      }
      else if (betType.includes('kart')) {
        const thresholdMatch = betType.match(/[\d.]+/);
        const threshold = thresholdMatch ? parseFloat(thresholdMatch[0]) : 3.5;
        if (pred.includes('üst') || pred.includes('over')) isWinning = totalCards > threshold;
        else if (pred.includes('alt') || pred.includes('under')) isWinning = totalCards < threshold;
      }
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
      '1H': 'LIVE',
      'HT': 'HALFTIME',
      '2H': 'LIVE',
      'ET': 'LIVE',
      'P': 'LIVE',
      'FT': 'FINISHED',
      'AET': 'FINISHED',
      'PEN': 'FINISHED',
      'PST': 'POSTPONED',
      'CANC': 'CANCELLED',
      'ABD': 'CANCELLED',
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
      const anyStarted = coupon.selections.some(s => !['PENDING'].includes(s.status));

      let newStatus: string;

      // 🔴 BİR MAÇ BİLE YATARSA KUPON YATAR — bu en öncelikli kural!
      if (anyLost) {
        newStatus = 'LOST';
      } else if (allWon) {
        newStatus = 'WON';
      } else if (anyLive) {
        newStatus = 'LIVE';
      } else if (anyStarted) {
        newStatus = 'LIVE';
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
          
          // 📊 İstatistikleri güncelle
          await this.statisticsService.updateStatsOnCouponSettled(
            coupon.userId, 'WON', Number(coupon.stakeAmount), Number(coupon.potentialWin),
          ).catch(e => console.error('İstatistik güncelleme hatası:', e.message));
        } else if (newStatus === 'LOST') {
          // ❌ Kupon kaybetti
          this.liveGateway.emitCouponUpdate(coupon.id, {
            type: 'COUPON_LOST',
            couponId: coupon.id,
            title: coupon.title,
            message: `❌ "${coupon.title}" kuponu kaybetti.`,
          });

          console.log(`❌ KUPON KAYBETTİ: "${coupon.title}"`);
          
          // 📊 İstatistikleri güncelle
          await this.statisticsService.updateStatsOnCouponSettled(
            coupon.userId, 'LOST', Number(coupon.stakeAmount), Number(coupon.potentialWin),
          ).catch(e => console.error('İstatistik güncelleme hatası:', e.message));
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
