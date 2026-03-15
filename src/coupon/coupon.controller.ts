import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CouponService } from './coupon.service';
import { CreateCouponDto, CreateCouponFromPhotoDto } from './dto/create-coupon.dto';
import { AiOcrService } from '../ai-ocr/ai-ocr.service';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('coupons')
@Controller('coupons')
export class CouponController {
  constructor(
    private readonly couponService: CouponService,
    private readonly aiOcrService: AiOcrService,
    private readonly prisma: PrismaService,
  ) {}

  private async getFallbackUserId(reqInfo: any): Promise<string> {
    if (reqInfo?.user?.sub) return reqInfo.user.sub;
    
    // Veritabanından herhangi bir aktif kullanıcı bul
    let user = await this.prisma.user.findFirst();

    // Veritabanı tamamen boşsa (clean-db çalıştıysa) dummy bir kullanıcı oluştur
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          id: 'c731cc5b-8d7c-4f1c-a529-9c94ea20e775',
          telegramId: 'demo_' + Date.now().toString(),
          username: 'demouser',
          firstName: 'Demo',
          lastName: 'User',
          role: 'ADMIN',
        },
      });
      console.log('✅ Veritabanı boş olduğu için otomatik Demo Kullanıcı oluşturuldu:', user.id);
    }

    return user.id;
  }

  @Post()
  @ApiOperation({ summary: 'Manuel kupon oluştur' })
  async createCoupon(@Request() req: any, @Body() dto: CreateCouponDto) {
    const userId = await this.getFallbackUserId(req);
    return this.couponService.createCoupon(userId, dto);
  }

  @Post('from-photo')
  @ApiOperation({ summary: 'Fotoğraftan AI ile kupon oluştur' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('photo'))
  async createFromPhoto(
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateCouponFromPhotoDto,
  ) {
    // AI ile fotoğrafı analiz et
    const parsedData = await this.aiOcrService.parseCouponPhoto(file);

    // Kuponu oluştur
    const userId = await this.getFallbackUserId(req);
    return this.couponService.createCouponFromAI(
      userId,
      parsedData,
      file.path || '',
      dto.visibility,
      dto.title,
    );
  }

  @Get('feed')
  @ApiOperation({ summary: 'Public kupon akışı' })
  async getPublicFeed(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.couponService.getPublicFeed(page, limit);
  }

  @Get('my-coupons')
  @ApiOperation({ summary: 'Kullanıcının kuponları' })
  async getMyCoupons(
    @Request() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    const userId = await this.getFallbackUserId(req);
    return this.couponService.getUserCoupons(userId, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Kupon detayı' })
  async getCoupon(@Param('id') id: string) {
    return this.couponService.getCouponById(id);
  }

  @Post(':id/play')
  @ApiOperation({ summary: 'Kuponu kopyala/oyna' })
  async playCoupon(
    @Request() req: any,
    @Param('id') id: string,
    @Body('stakeAmount') stakeAmount: number,
  ) {
    const userId = await this.getFallbackUserId(req);
    return this.couponService.playCoupon(userId, id, stakeAmount);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Kupon sil' })
  async deleteCoupon(@Request() req: any, @Param('id') id: string) {
    const userId = await this.getFallbackUserId(req);
    return this.couponService.deleteCoupon(userId, id);
  }
}
