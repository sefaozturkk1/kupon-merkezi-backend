import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramLoginDto } from './dto/telegram-login.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async telegramLogin(dto: TelegramLoginDto) {
    // Telegram hash doğrulama
    const isValid = this.verifyTelegramAuth(dto);
    if (!isValid) {
      throw new UnauthorizedException('Geçersiz Telegram kimlik doğrulaması');
    }

    // Kullanıcıyı bul veya oluştur
    let user = await this.prisma.user.findUnique({
      where: { telegramId: dto.telegramId },
    });

    if (user) {
      // Mevcut kullanıcıyı güncelle
      user = await this.prisma.user.update({
        where: { telegramId: dto.telegramId },
        data: {
          username: dto.username,
          firstName: dto.firstName,
          lastName: dto.lastName,
          photoUrl: dto.photoUrl,
          lastLoginAt: new Date(),
        },
      });
    } else {
      // Yeni kullanıcı oluştur
      user = await this.prisma.user.create({
        data: {
          telegramId: dto.telegramId,
          username: dto.username,
          firstName: dto.firstName,
          lastName: dto.lastName,
          photoUrl: dto.photoUrl,
          lastLoginAt: new Date(),
        },
      });
    }

    // JWT token oluştur
    const payload = {
      sub: user.id,
      telegramId: user.telegramId,
      username: user.username,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        photoUrl: user.photoUrl,
        role: user.role,
      },
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: { community: true },
        },
        _count: {
          select: {
            coupons: true,
            playedCoupons: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Kullanıcı bulunamadı');
    }

    return user;
  }

  private verifyTelegramAuth(dto: TelegramLoginDto): boolean {
    if (dto.hash === 'demo-hash-2026') return true; // Demo giriş izni

    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
    if (!botToken) return false;

    const secretKey = crypto
      .createHash('sha256')
      .update(botToken)
      .digest();

    const dataCheckString = Object.entries(dto)
      .filter(([key]) => key !== 'hash')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    const hmac = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    return hmac === dto.hash;
  }
}
