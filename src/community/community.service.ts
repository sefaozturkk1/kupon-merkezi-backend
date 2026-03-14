import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CommunityService {
  constructor(private prisma: PrismaService) {}

  // Topluluk oluşturma
  async createCommunity(
    userId: string,
    data: {
      telegramGroupId: string;
      name: string;
      description?: string;
      photoUrl?: string;
      inviteLink?: string;
    },
  ) {
    const community = await this.prisma.community.create({
      data: {
        ...data,
        ownerId: userId,
        members: {
          create: {
            userId,
            role: 'ADMIN',
          },
        },
      },
      include: {
        owner: {
          select: { id: true, username: true, firstName: true, photoUrl: true },
        },
        _count: { select: { members: true } },
      },
    });

    return community;
  }

  // Tüm toplulukları listele
  async getCommunities(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [communities, total] = await Promise.all([
      this.prisma.community.findMany({
        where: { isActive: true },
        include: {
          owner: {
            select: { id: true, username: true, firstName: true, photoUrl: true },
          },
          _count: { select: { members: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.community.count({ where: { isActive: true } }),
    ]);

    return { data: communities, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  // Topluluğa katılma
  async joinCommunity(userId: string, communityId: string) {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
    });

    if (!community) throw new NotFoundException('Topluluk bulunamadı');

    const existing = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId, communityId } },
    });

    if (existing) return { message: 'Zaten üyesiniz' };

    await this.prisma.communityMember.create({
      data: { userId, communityId },
    });

    return { message: 'Topluluğa başarıyla katıldınız' };
  }

  // Topluluktan ayrılma
  async leaveCommunity(userId: string, communityId: string) {
    await this.prisma.communityMember.deleteMany({
      where: { userId, communityId },
    });

    return { message: 'Topluluktan ayrıldınız' };
  }

  // Topluluk akışı (o topluluktaki public kuponlar)
  async getCommunityFeed(communityId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    // Topluluk üyelerinin public kuponlarını getir
    const memberIds = await this.prisma.communityMember.findMany({
      where: { communityId },
      select: { userId: true },
    });

    const userIds = memberIds.map((m) => m.userId);

    const [coupons, total] = await Promise.all([
      this.prisma.coupon.findMany({
        where: {
          userId: { in: userIds },
          visibility: 'PUBLIC',
        },
        include: {
          selections: true,
          user: {
            select: { id: true, username: true, firstName: true, photoUrl: true },
          },
          _count: { select: { playedBy: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.coupon.count({
        where: { userId: { in: userIds }, visibility: 'PUBLIC' },
      }),
    ]);

    return { data: coupons, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  // Duyuru oluşturma (sadece admin)
  async createAnnouncement(
    userId: string,
    communityId: string,
    data: { title: string; content: string; imageUrl?: string; isPinned?: boolean },
  ) {
    const membership = await this.prisma.communityMember.findUnique({
      where: { userId_communityId: { userId, communityId } },
    });

    if (!membership || membership.role === 'MEMBER') {
      throw new ForbiddenException('Duyuru oluşturma yetkiniz yok');
    }

    return this.prisma.announcement.create({
      data: {
        ...data,
        communityId,
        authorId: userId,
      },
      include: {
        author: {
          select: { id: true, username: true, firstName: true, photoUrl: true },
        },
      },
    });
  }

  // Duyuruları getir
  async getAnnouncements(communityId: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [announcements, total] = await Promise.all([
      this.prisma.announcement.findMany({
        where: { communityId },
        include: {
          author: {
            select: { id: true, username: true, firstName: true, photoUrl: true },
          },
        },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.announcement.count({ where: { communityId } }),
    ]);

    return { data: announcements, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }
}
