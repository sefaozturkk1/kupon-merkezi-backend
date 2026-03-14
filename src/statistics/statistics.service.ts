import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class StatisticsService {
  constructor(private prisma: PrismaService) {}

  // Kullanıcı istatistiklerini getir
  async getUserStats(
    userId: string,
    period: 'daily' | 'monthly' | 'yearly' | 'all' = 'all',
  ) {
    const dateFilter = this.getDateFilter(period);

    const coupons = await this.prisma.coupon.findMany({
      where: {
        userId,
        createdAt: { gte: dateFilter },
        status: { in: ['WON', 'LOST'] },
      },
      select: {
        status: true,
        stakeAmount: true,
        potentialWin: true,
        totalOdds: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const totalCoupons = coupons.length;
    const wonCoupons = coupons.filter(c => c.status === 'WON');
    const lostCoupons = coupons.filter(c => c.status === 'LOST');

    // Kazanç: (Oran x Miktar) - Miktar = Net Kâr
    const totalWon = wonCoupons.reduce(
      (sum, c) => sum + (Number(c.potentialWin) - Number(c.stakeAmount)),
      0,
    );

    // Kayıp: basılan miktar
    const totalLost = lostCoupons.reduce(
      (sum, c) => sum + Number(c.stakeAmount),
      0,
    );

    const netProfit = totalWon - totalLost;
    const totalStaked = coupons.reduce((sum, c) => sum + Number(c.stakeAmount), 0);
    const winRate = totalCoupons > 0 ? (wonCoupons.length / totalCoupons) * 100 : 0;
    const profitMargin = totalStaked > 0 ? (netProfit / totalStaked) * 100 : 0;

    // Grafik verisi (zaman bazlı kazanç/kayıp)
    const chartData = this.buildChartData(coupons, period);

    return {
      summary: {
        totalCoupons,
        wonCoupons: wonCoupons.length,
        lostCoupons: lostCoupons.length,
        winRate: Number(winRate.toFixed(1)),
        totalStaked: Number(totalStaked.toFixed(2)),
        totalWon: Number(totalWon.toFixed(2)),
        totalLost: Number(totalLost.toFixed(2)),
        netProfit: Number(netProfit.toFixed(2)),
        profitMargin: Number(profitMargin.toFixed(2)),
      },
      chartData,
    };
  }

  // Kupon sonuçlanınca istatistikleri güncelle
  async updateStatsOnCouponSettled(
    userId: string,
    couponStatus: 'WON' | 'LOST',
    stakeAmount: number,
    potentialWin: number,
  ) {
    const now = new Date();
    const periods = [
      { period: 'DAILY' as const, date: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
      { period: 'MONTHLY' as const, date: new Date(now.getFullYear(), now.getMonth(), 1) },
      { period: 'YEARLY' as const, date: new Date(now.getFullYear(), 0, 1) },
      { period: 'ALL_TIME' as const, date: new Date(2020, 0, 1) },
    ];

    for (const { period, date } of periods) {
      const existing = await this.prisma.userStatistic.findUnique({
        where: {
          userId_period_periodDate: { userId, period, periodDate: date },
        },
      });

      const netChange = couponStatus === 'WON'
        ? potentialWin - stakeAmount
        : -stakeAmount;

      if (existing) {
        await this.prisma.userStatistic.update({
          where: { id: existing.id },
          data: {
            totalCoupons: { increment: 1 },
            ...(couponStatus === 'WON' ? { wonCoupons: { increment: 1 } } : { lostCoupons: { increment: 1 } }),
            totalStaked: { increment: stakeAmount },
            ...(couponStatus === 'WON'
              ? { totalWon: { increment: potentialWin - stakeAmount } }
              : { totalLost: { increment: stakeAmount } }),
            netProfit: { increment: netChange },
          },
        });
      } else {
        await this.prisma.userStatistic.create({
          data: {
            userId,
            period,
            periodDate: date,
            totalCoupons: 1,
            wonCoupons: couponStatus === 'WON' ? 1 : 0,
            lostCoupons: couponStatus === 'LOST' ? 1 : 0,
            totalStaked: new Prisma.Decimal(stakeAmount),
            totalWon: couponStatus === 'WON' ? new Prisma.Decimal(potentialWin - stakeAmount) : new Prisma.Decimal(0),
            totalLost: couponStatus === 'LOST' ? new Prisma.Decimal(stakeAmount) : new Prisma.Decimal(0),
            netProfit: new Prisma.Decimal(netChange),
          },
        });
      }
    }
  }

  private buildChartData(coupons: any[], period: string) {
    const grouped: Record<string, { profit: number; loss: number }> = {};

    for (const coupon of coupons) {
      let key: string;
      const date = new Date(coupon.createdAt);

      switch (period) {
        case 'daily':
          key = `${date.getHours()}:00`;
          break;
        case 'monthly':
          key = `${date.getDate()}`;
          break;
        case 'yearly':
          key = `${date.toLocaleString('tr-TR', { month: 'short' })}`;
          break;
        default:
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!grouped[key]) grouped[key] = { profit: 0, loss: 0 };

      if (coupon.status === 'WON') {
        grouped[key].profit += Number(coupon.potentialWin) - Number(coupon.stakeAmount);
      } else {
        grouped[key].loss += Number(coupon.stakeAmount);
      }
    }

    return Object.entries(grouped).map(([label, data]) => ({
      label,
      profit: Number(data.profit.toFixed(2)),
      loss: Number(data.loss.toFixed(2)),
      net: Number((data.profit - data.loss).toFixed(2)),
    }));
  }

  private getDateFilter(period: string): Date {
    const now = new Date();
    switch (period) {
      case 'daily':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth(), 1);
      case 'yearly':
        return new Date(now.getFullYear(), 0, 1);
      default:
        return new Date(0);
    }
  }
}
