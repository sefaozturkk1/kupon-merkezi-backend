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

@ApiTags('coupons')
@Controller('coupons')
export class CouponController {
  constructor(
    private readonly couponService: CouponService,
    private readonly aiOcrService: AiOcrService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Manuel kupon oluştur' })
  async createCoupon(@Request() req: any, @Body() dto: CreateCouponDto) {
    const userId = req.user?.sub || 'c731cc5b-8d7c-4f1c-a529-9c94ea20e775';
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
    const userId = req.user?.sub || 'c731cc5b-8d7c-4f1c-a529-9c94ea20e775';
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
    return this.couponService.getUserCoupons(req.user?.sub || 'c731cc5b-8d7c-4f1c-a529-9c94ea20e775', page, limit);
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
    return this.couponService.playCoupon(req.user?.sub || 'c731cc5b-8d7c-4f1c-a529-9c94ea20e775', id, stakeAmount);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Kupon sil' })
  async deleteCoupon(@Request() req: any, @Param('id') id: string) {
    return this.couponService.deleteCoupon(req.user?.sub || 'c731cc5b-8d7c-4f1c-a529-9c94ea20e775', id);
  }
}
