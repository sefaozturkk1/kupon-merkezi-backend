import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LeaderboardService {
  constructor(private prisma: PrismaService) {}

  // En çok oynanan / kopyalanan kuponlar
  async getMostPlayedCoupons(
    period: 'daily' | 'weekly' | 'monthly' = 'weekly',
    communityId?: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const dateFilter = this.getDateFilter(period);
    const skip = (page - 1) * limit;

    // Community filter için kullanıcı ID'lerini hazırla
    let userIds: string[] | undefined;
    if (communityId) {
      const members = await this.prisma.communityMember.findMany({
        where: { communityId },
        select: { userId: true },
      });
      userIds = members.map(m => m.userId);
    }

    const coupons = await this.prisma.coupon.findMany({
      where: {
        visibility: 'PUBLIC',
        createdAt: { gte: dateFilter },
        ...(userIds ? { userId: { in: userIds } } : {}),
      },
      include: {
        user: {
          select: { id: true, username: true, firstName: true, photoUrl: true },
        },
        selections: true,
        _count: { select: { playedBy: true } },
      },
      orderBy: {
        playedBy: { _count: 'desc' },
      },
      skip,
      take: limit,
    });

    return coupons.map((coupon, index) => ({
      rank: skip + index + 1,
      coupon,
      playCount: coupon._count.playedBy,
    }));
  }

  // En başarılı kullanıcılar
  async getTopUsers(
    period: 'daily' | 'weekly' | 'monthly' = 'weekly',
    communityId?: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const dateFilter = this.getDateFilter(period);
    const skip = (page - 1) * limit;

    let userFilter: any = {};
    if (communityId) {
      const members = await this.prisma.communityMember.findMany({
        where: { communityId },
        select: { userId: true },
      });
      userFilter = { id: { in: members.map(m => m.userId) } };
    }

    const users = await this.prisma.user.findMany({
      where: {
        ...userFilter,
        coupons: {
          some: {
            createdAt: { gte: dateFilter },
            status: 'WON',
          },
        },
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        photoUrl: true,
        _count: {
          select: {
            coupons: {
              where: { createdAt: { gte: dateFilter } },
            },
          },
        },
        coupons: {
          where: {
            createdAt: { gte: dateFilter },
            status: { in: ['WON', 'LOST'] },
          },
          select: {
            status: true,
            stakeAmount: true,
            potentialWin: true,
          },
        },
      },
      skip,
      take: limit,
    });

    // Kazanç hesapla ve sırala
    const rankedUsers = users
      .map(user => {
        const wonCoupons = user.coupons.filter(c => c.status === 'WON');
        const lostCoupons = user.coupons.filter(c => c.status === 'LOST');
        const totalWon = wonCoupons.reduce((sum, c) => sum + (Number(c.potentialWin) - Number(c.stakeAmount)), 0);
        const totalLost = lostCoupons.reduce((sum, c) => sum + Number(c.stakeAmount), 0);

        return {
          user: {
            id: user.id,
            username: user.username,
            firstName: user.firstName,
            photoUrl: user.photoUrl,
          },
          totalCoupons: user._count.coupons,
          wonCount: wonCoupons.length,
          lostCount: lostCoupons.length,
          winRate: user.coupons.length > 0
            ? ((wonCoupons.length / user.coupons.length) * 100).toFixed(1)
            : '0',
          netProfit: (totalWon - totalLost).toFixed(2),
        };
      })
      .sort((a, b) => parseFloat(b.netProfit) - parseFloat(a.netProfit))
      .map((u, i) => ({ rank: skip + i + 1, ...u }));

    return rankedUsers;
  }

  private getDateFilter(period: string): Date {
    const now = new Date();
    switch (period) {
      case 'daily':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case 'weekly':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        weekStart.setHours(0, 0, 0, 0);
        return weekStart;
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth(), 1);
      default:
        return new Date(0);
    }
  }
}
