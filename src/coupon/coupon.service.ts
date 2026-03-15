import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCouponDto } from './dto/create-coupon.dto';
import { FootballApiService } from '../football-api/football-api.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class CouponService {
  constructor(
    private prisma: PrismaService,
    private footballApi: FootballApiService,
  ) {}

  // Manuel kupon oluşturma
  async createCoupon(userId: string, dto: CreateCouponDto) {
    let totalOdds = dto.customTotalOdds;
    if (!totalOdds || totalOdds < 1.0) {
      totalOdds = dto.selections.reduce((acc, sel) => acc * sel.odds, 1);
    }
    
    const potentialWin = totalOdds * dto.stakeAmount;

    const coupon = await this.prisma.coupon.create({
      data: {
        title: dto.title,
        totalOdds: new Prisma.Decimal(totalOdds.toFixed(2)),
        stakeAmount: new Prisma.Decimal(dto.stakeAmount),
        potentialWin: new Prisma.Decimal(potentialWin.toFixed(2)),
        currency: dto.currency || 'TRY',
        visibility: dto.visibility as any,
        source: 'MANUAL',
        userId,
        selections: {
          create: dto.selections.map((sel) => ({
            matchId: sel.matchId,
            homeTeam: sel.homeTeam,
            awayTeam: sel.awayTeam,
            league: sel.league,
            matchDate: sel.matchDate,
            betType: sel.betType,
            prediction: sel.prediction,
            odds: new Prisma.Decimal(sel.odds),
          })),
        },
      },
      include: {
        selections: true,
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            photoUrl: true,
          },
        },
      },
    });

    return coupon;
  }

  // AI/Fotoğraftan kupon oluşturma — matchId eşleştirmeli
  async createCouponFromAI(
    userId: string,
    parsedData: any,
    photoUrl: string,
    visibility: string,
    title?: string,
  ) {
    const couponTitle = title || parsedData.title || 'AI Kupon';
    
    // Selections'ları hazırla + matchId eşleştir
    const sanitizedSelections: any[] = [];

    for (const sel of (parsedData.selections || [])) {
      const homeTeam = sel.homeTeam || 'Bilinmiyor';
      const awayTeam = sel.awayTeam || 'Bilinmiyor';
      
      // 🔑 API'den takımı ara ve matchId bul
      let matchId: string | null = null;
      let matchDate: Date | null = null;
      let matchStatus: string = 'NOT_STARTED';
      let homeScore: number | null = null;
      let awayScore: number | null = null;
      
      try {
        // Ev sahibi takımı ara (Türkçe karakter ve sembolleri İngilizce'ye çevirip API hata vermesin diye temizle)
        const safeSearchTerm = homeTeam.replace(/İ/g, 'I').replace(/ı/g, 'i').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9 ]/g, '');
        const teams = await this.footballApi.searchTeam(safeSearchTerm);
        if (teams.length > 0) {
          const teamId = teams[0].id;
          // Bu takımın yaklaşan VE geçmiş/canlı maçlarını çek
          const upcoming = await this.footballApi.getTeamMatches(teamId, 'SCHEDULED');
          const recent = await this.footballApi.getTeamFinishedMatches(teamId);
          const live = await this.footballApi.getTeamLiveMatches(teamId);
          const matches = [...live, ...upcoming, ...recent];
          
          // Takım isimlerini Türkçe karakterlerden arındırıp normalize eden yardımcı fonksiyon
          const normalizeName = (name: string) => {
            return (name || '')
              .replace(/İ/g, 'I').replace(/ı/g, 'i')
              .replace(/Ö/g, 'O').replace(/ö/g, 'o')
              .replace(/Ü/g, 'U').replace(/ü/g, 'u')
              .replace(/Ş/g, 'S').replace(/ş/g, 's')
              .replace(/Ğ/g, 'G').replace(/ğ/g, 'g')
              .replace(/Ç/g, 'C').replace(/ç/g, 'c')
              .toLowerCase()
              .replace(/[^a-z0-9]/g, '');
          };

          // Deplasman takımıyla eşleşen maçı bul
          const matchFound = matches.find((m: any) => {
            const mAway = normalizeName(m.awayTeam?.name);
            const mHome = normalizeName(m.homeTeam?.name);
            const targetAway = normalizeName(awayTeam);
            const targetHome = normalizeName(homeTeam);
            
            return mAway.includes(targetAway) || targetAway.includes(mAway) || 
                   mHome.includes(targetHome) || targetHome.includes(mHome);
          });

          if (matchFound) {
            matchId = String(matchFound.matchId);
            matchDate = matchFound.date ? new Date(matchFound.date) : null;
            
            // Canlı maç durumunu ve skorunu kaydet
            if (matchFound.status === 'IN_PLAY' || matchFound.status === 'PAUSED') {
              matchStatus = matchFound.status === 'PAUSED' ? 'HALFTIME' : 'LIVE';
              homeScore = matchFound.score?.homeFullTime ?? 0;
              awayScore = matchFound.score?.awayFullTime ?? 0;
              console.log(`🔴 CANLI MAÇ: ${homeTeam} vs ${awayTeam} → ${matchId} | Skor: ${homeScore}-${awayScore} | Durum: ${matchStatus}`);
            } else if (matchFound.status === 'FINISHED') {
              matchStatus = 'FINISHED';
              homeScore = matchFound.score?.homeFullTime ?? 0;
              awayScore = matchFound.score?.awayFullTime ?? 0;
              console.log(`✅ BİTMİŞ MAÇ: ${homeTeam} vs ${awayTeam} → ${matchId} | Skor: ${homeScore}-${awayScore}`);
            } else {
              console.log(`✅ AI Kupon matchId eşleştirildi: ${homeTeam} vs ${awayTeam} → ${matchId} (${matchDate})`);
            }
          } else {
            console.log(`❌ Maç eşleşmedi: ${homeTeam} vs ${awayTeam}. Bulunan API Maçları:`, matches.map(m => `${m.homeTeam?.name} - ${m.awayTeam?.name}`));
          }
        } else {
          console.log(`❌ Takım API'de bulunamadı: ${homeTeam}`);
        }
      } catch (e) {
        console.warn(`⚠️ matchId eşleştirme hatası (${homeTeam} vs ${awayTeam}):`, e.message);
      }

      sanitizedSelections.push({
        matchId,
        matchDate,
        homeTeam,
        awayTeam,
        league: sel.league || null,
        betType: sel.betType || 'Bilinmiyor',
        prediction: sel.prediction || '-',
        odds: typeof sel.odds === 'number' && !isNaN(sel.odds) && sel.odds > 0 ? sel.odds : 1.0,
        matchStatus,
        homeScore,
        awayScore,
      });
    }

    let totalOdds = parsedData.totalOdds;
    if (!totalOdds || totalOdds < 1.0) {
      totalOdds = sanitizedSelections.reduce(
        (acc: number, sel: any) => acc * sel.odds,
        1,
      );
    }
    
    const stakeAmount = Number(parsedData.stakeAmount) || 10;
    const potentialWin = totalOdds * stakeAmount;

    // Kuponda canlı maç varsa kupon durumunu LIVE yap
    const hasLiveMatch = sanitizedSelections.some((sel: any) => sel.matchStatus === 'LIVE' || sel.matchStatus === 'HALFTIME');
    const couponStatus = hasLiveMatch ? 'LIVE' : 'PENDING';

    const coupon = await this.prisma.coupon.create({
      data: {
        title: couponTitle,
        status: couponStatus as any,
        totalOdds: new Prisma.Decimal(totalOdds.toFixed(2)),
        stakeAmount: new Prisma.Decimal(stakeAmount),
        potentialWin: new Prisma.Decimal(potentialWin.toFixed(2)),
        visibility: visibility as any,
        source: 'AI_PHOTO',
        photoUrl,
        userId,
        selections: {
          create: sanitizedSelections.map((sel: any) => ({
            matchId: sel.matchId,
            matchDate: sel.matchDate,
            homeTeam: sel.homeTeam,
            awayTeam: sel.awayTeam,
            league: sel.league,
            betType: sel.betType,
            prediction: sel.prediction,
            odds: new Prisma.Decimal(sel.odds.toFixed(2)),
            matchStatus: sel.matchStatus,
            homeScore: sel.homeScore,
            awayScore: sel.awayScore,
          })),
        },
      },
      include: {
        selections: true,
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            photoUrl: true,
          },
        },
      },
    });

    return coupon;
  }

  // Kupon detayı
  async getCouponById(couponId: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id: couponId },
      include: {
        selections: true,
        user: {
          select: {
            id: true,
            username: true,
            firstName: true,
            photoUrl: true,
          },
        },
        _count: {
          select: { playedBy: true },
        },
      },
    });

    if (!coupon) {
      throw new NotFoundException('Kupon bulunamadı');
    }

    return coupon;
  }

  // Public kupon akışı (Feed)
  async getPublicFeed(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [coupons, total] = await Promise.all([
      this.prisma.coupon.findMany({
        where: { visibility: 'PUBLIC' },
        include: {
          selections: true,
          user: {
            select: {
              id: true,
              username: true,
              firstName: true,
              photoUrl: true,
            },
          },
          _count: {
            select: { playedBy: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.coupon.count({ where: { visibility: 'PUBLIC' } }),
    ]);

    return {
      data: coupons,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Kullanıcının kendi kuponları
  async getUserCoupons(userId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [coupons, total] = await Promise.all([
      this.prisma.coupon.findMany({
        where: { userId },
        include: {
          selections: true,
          _count: {
            select: { playedBy: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.coupon.count({ where: { userId } }),
    ]);

    return {
      data: coupons,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // Kuponu kopyala / oyna
  async playCoupon(userId: string, couponId: string, stakeAmount: number) {
    const originalCoupon = await this.prisma.coupon.findUnique({
      where: { id: couponId },
      include: { selections: true },
    });

    if (!originalCoupon) {
      throw new NotFoundException('Kupon bulunamadı');
    }

    if (originalCoupon.visibility === 'PRIVATE' && originalCoupon.userId !== userId) {
      throw new ForbiddenException('Bu kupon özeldir, kopyalanamaz');
    }

    const totalOdds = Number(originalCoupon.totalOdds);
    const potentialWin = totalOdds * stakeAmount;

    const playedCoupon = await this.prisma.playedCoupon.create({
      data: {
        userId,
        originalCouponId: couponId,
        stakeAmount: new Prisma.Decimal(stakeAmount),
        potentialWin: new Prisma.Decimal(potentialWin.toFixed(2)),
      },
      include: {
        originalCoupon: {
          include: { selections: true },
        },
      },
    });

    return playedCoupon;
  }

  // Kupon silme
  async deleteCoupon(userId: string, couponId: string) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id: couponId },
    });

    if (!coupon) {
      throw new NotFoundException('Kupon bulunamadı');
    }

    if (coupon.userId !== userId) {
      throw new ForbiddenException('Bu kuponu silme yetkiniz yok');
    }

    await this.prisma.coupon.delete({
      where: { id: couponId },
    });

    return { message: 'Kupon başarıyla silindi' };
  }
}
