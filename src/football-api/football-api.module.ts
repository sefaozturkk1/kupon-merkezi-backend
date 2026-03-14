import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FootballApiService } from './football-api.service';
import { FootballApiController } from './football-api.controller';

@Module({
  imports: [ConfigModule],
  controllers: [FootballApiController],
  providers: [FootballApiService],
  exports: [FootballApiService],
})
export class FootballApiModule {}
