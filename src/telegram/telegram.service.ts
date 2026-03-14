import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private botToken: string;
  private baseUrl: string;

  constructor(private configService: ConfigService) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') || '';
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  // Telegram kanalına kupon paylaş
  async shareCouponToChannel(
    chatId: string,
    couponData: {
      title: string;
      username: string;
      selections: {
        homeTeam: string;
        awayTeam: string;
        prediction: string;
        odds: number;
      }[];
      totalOdds: number;
      stakeAmount: number;
      potentialWin: number;
    },
  ) {
    const message = this.formatCouponMessage(couponData);

    try {
      const response = await axios.post(`${this.baseUrl}/sendMessage`, {
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      });

      return response.data.result.message_id;
    } catch (error) {
      this.logger.error(`Telegram mesaj gönderme hatası: ${error.message}`);
      return null;
    }
  }

  // Duyuru gönder
  async sendAnnouncement(
    chatId: string,
    title: string,
    content: string,
    imageUrl?: string,
  ) {
    try {
      if (imageUrl) {
        await axios.post(`${this.baseUrl}/sendPhoto`, {
          chat_id: chatId,
          photo: imageUrl,
          caption: `<b>📢 ${title}</b>\n\n${content}`,
          parse_mode: 'HTML',
        });
      } else {
        await axios.post(`${this.baseUrl}/sendMessage`, {
          chat_id: chatId,
          text: `<b>📢 ${title}</b>\n\n${content}`,
          parse_mode: 'HTML',
        });
      }
    } catch (error) {
      this.logger.error(`Telegram duyuru gönderme hatası: ${error.message}`);
    }
  }

  // Bot bilgilerini getir
  async getBotInfo() {
    try {
      const response = await axios.get(`${this.baseUrl}/getMe`);
      return response.data.result;
    } catch (error) {
      this.logger.error(`Bot bilgisi alınamadı: ${error.message}`);
      return null;
    }
  }

  private formatCouponMessage(couponData: any): string {
    let message = `🏆 <b>KUPON MERKEZİ</b>\n`;
    message += `━━━━━━━━━━━━━━━\n`;
    message += `📋 <b>${couponData.title}</b>\n`;
    message += `👤 ${couponData.username}\n`;
    message += `━━━━━━━━━━━━━━━\n\n`;

    couponData.selections.forEach((sel: any, idx: number) => {
      message += `⚽ <b>${sel.homeTeam}</b> vs <b>${sel.awayTeam}</b>\n`;
      message += `   📊 Tahmin: <code>${sel.prediction}</code> | Oran: <code>${sel.odds}</code>\n\n`;
    });

    message += `━━━━━━━━━━━━━━━\n`;
    message += `📈 Toplam Oran: <b>${couponData.totalOdds.toFixed(2)}</b>\n`;
    message += `💰 Miktar: <b>${couponData.stakeAmount} ₺</b>\n`;
    message += `🎯 Potansiyel Kazanç: <b>${couponData.potentialWin.toFixed(2)} ₺</b>\n`;
    message += `━━━━━━━━━━━━━━━\n`;
    message += `\n📲 <i>Kupon Merkezi App'ten paylaşıldı</i>`;

    return message;
  }
}
