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
      
      try {
        // Ev sahibi takımı ara
        const teams = await this.footballApi.searchTeam(homeTeam);
        if (teams.length > 0) {
          const teamId = teams[0].id;
          // Bu takımın yaklaşan maçlarını çek
          const matches = await this.footballApi.getTeamMatches(teamId, 'SCHEDULED');
          
          // Deplasman takımıyla eşleşen maçı bul
          const matchFound = matches.find((m: any) => {
            const awayName = (m.awayTeam?.name || '').toLowerCase();
            const homeName = (m.homeTeam?.name || '').toLowerCase();
            return awayName.includes(awayTeam.toLowerCase()) || 
                   homeName.includes(homeTeam.toLowerCase());
          });

          if (matchFound) {
            matchId = String(matchFound.matchId);
            console.log(`✅ AI Kupon matchId eşleştirildi: ${homeTeam} vs ${awayTeam} → ${matchId}`);
          }
        }
      } catch (e) {
        console.warn(`⚠️ matchId eşleştirme hatası (${homeTeam} vs ${awayTeam}):`, e.message);
      }

      sanitizedSelections.push({
        matchId,
        homeTeam,
        awayTeam,
        league: sel.league || null,
        betType: sel.betType || 'Bilinmiyor',
        prediction: sel.prediction || '-',
        odds: typeof sel.odds === 'number' && !isNaN(sel.odds) && sel.odds > 0 ? sel.odds : 1.0,
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

    const coupon = await this.prisma.coupon.create({
      data: {
        title: couponTitle,
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
            homeTeam: sel.homeTeam,
            awayTeam: sel.awayTeam,
            league: sel.league,
            betType: sel.betType,
            prediction: sel.prediction,
            odds: new Prisma.Decimal(sel.odds.toFixed(2)),
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
