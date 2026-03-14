import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { TelegramLoginDto } from './dto/telegram-login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('telegram/login')
  @ApiOperation({ summary: 'Telegram ile giriş yap' })
  async telegramLogin(@Body() dto: TelegramLoginDto) {
    return this.authService.telegramLogin(dto);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Kullanıcı profilini getir' })
  async getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.sub);
  }
}
