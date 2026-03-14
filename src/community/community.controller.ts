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
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CommunityService } from './community.service';

@ApiTags('communities')
@Controller('communities')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Post()
  @ApiOperation({ summary: 'Topluluk oluştur' })
  async createCommunity(@Request() req: any, @Body() body: any) {
    return this.communityService.createCommunity(req.user.sub, body);
  }

  @Get()
  @ApiOperation({ summary: 'Toplulukları listele' })
  async getCommunities(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.communityService.getCommunities(page, limit);
  }

  @Post(':id/join')
  @ApiOperation({ summary: 'Topluluğa katıl' })
  async joinCommunity(@Request() req: any, @Param('id') id: string) {
    return this.communityService.joinCommunity(req.user.sub, id);
  }

  @Delete(':id/leave')
  @ApiOperation({ summary: 'Topluluktan ayrıl' })
  async leaveCommunity(@Request() req: any, @Param('id') id: string) {
    return this.communityService.leaveCommunity(req.user.sub, id);
  }

  @Get(':id/feed')
  @ApiOperation({ summary: 'Topluluk kupon akışı' })
  async getCommunityFeed(
    @Param('id') id: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.communityService.getCommunityFeed(id, page, limit);
  }

  @Post(':id/announcements')
  @ApiOperation({ summary: 'Duyuru oluştur' })
  async createAnnouncement(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return this.communityService.createAnnouncement(req.user.sub, id, body);
  }

  @Get(':id/announcements')
  @ApiOperation({ summary: 'Duyuruları getir' })
  async getAnnouncements(
    @Param('id') id: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.communityService.getAnnouncements(id, page, limit);
  }
}
