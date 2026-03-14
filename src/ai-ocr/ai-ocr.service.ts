import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface ParsedCouponData {
  title?: string;
  selections: {
    homeTeam: string;
    awayTeam: string;
    league?: string;
    betType: string;
    prediction: string;
    odds: number;
  }[];
  totalOdds?: number;
  stakeAmount?: number;
}

@Injectable()
export class AiOcrService {
  private geminiApiKey: string;

  constructor(private configService: ConfigService) {
    this.geminiApiKey = this.configService.get<string>('GEMINI_API_KEY') || '';
  }

  async parseCouponPhoto(file: Express.Multer.File): Promise<ParsedCouponData> {
    if (!file) {
      throw new BadRequestException('Fotoğraf yüklenmedi');
    }

    if (!this.geminiApiKey || this.geminiApiKey.includes('AIzaSy')) {
      // API Key hatalı veya eksikse dummy test datası uyarısına düşmesini engellemek için küçük bir check,
      // Fakat senin verdiğin key "AIzaSy..." ile başladığı için gerçek key var sayıp devam ediyoruz.
    }

    try {
      const base64Image = file.buffer.toString('base64');
      const mimeType = file.mimetype || 'image/jpeg';
      const promptText = `Sen bir bahis kuponu analiz asistanısın. Yüklenen kupon fotoğrafından
maçları, bahis seçeneklerini, oranları ve kupon bilgilerini çıkarıyorsun.

Yanıtını SADECE JSON formatında ver, markdown kullanma.

JSON formatı:
{
  "title": "Kupon adı (varsa)",
  "selections": [
    {
      "homeTeam": "Ev sahibi takım",
      "awayTeam": "Deplasman takımı",
      "league": "Lig adı (varsa)",
      "betType": "Bahis tipi (Maç Sonucu (1X2), Alt/Üst 2.5, vb.)",
      "prediction": "Tahmin (1, X, 2, Alt, Üst, vb.)",
      "odds": 1.50 // DİKKAT: Sadece bu maçın oranı. Kuponun toplam oranını asla buraya yazma! Eğer maç oranı belli değilse 1.0 yaz.
    }
  ],
  "totalOdds": 15.00, // DİKKAT: Kuponun genel Toplam Oranı buraya yazılacak.
  "stakeAmount": 100
}`;

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.geminiApiKey}`,
        {
          contents: [
            {
              parts: [
                { text: promptText },
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Image,
                  },
                },
              ],
            },
          ],
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      const content = response.data?.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (!content) {
        throw new BadRequestException('AI yanıt döndürmedi (Gemini API boş döndü)');
      }

      // JSON parse et (Markdown kodu içinde geldiyse temizle)
      const jsonStr = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed: ParsedCouponData = JSON.parse(jsonStr);

      // Doğrulama
      if (!parsed.selections || parsed.selections.length === 0) {
        throw new BadRequestException('Kuponda maç bulunamadı');
      }

      return parsed;
    } catch (error: any) {
      console.error('Gemini API Error:', error.response?.data || error.message);
      
      const errorMessage = error.response?.data?.error?.message || error.message;
      
      if (errorMessage.includes('API key not valid')) {
        throw new BadRequestException('Gemini API anahtarı geçersiz!');
      }
      
      throw new BadRequestException('Kupon fotoğrafı analiz edilemedi, lütfen daha net çekin: ' + errorMessage);
    }
  }
}
