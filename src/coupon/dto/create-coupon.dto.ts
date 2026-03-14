import { IsString, IsNotEmpty, IsOptional, IsNumber, IsEnum, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSelectionDto {
  @ApiPropertyOptional({ description: 'API-Football maç ID' })
  @IsString()
  @IsOptional()
  matchId?: string;

  @ApiProperty({ description: 'Ev sahibi takım' })
  @IsString()
  @IsNotEmpty()
  homeTeam: string;

  @ApiProperty({ description: 'Deplasman takımı' })
  @IsString()
  @IsNotEmpty()
  awayTeam: string;

  @ApiPropertyOptional({ description: 'Lig adı' })
  @IsString()
  @IsOptional()
  league?: string;

  @ApiPropertyOptional({ description: 'Maç tarihi' })
  @IsOptional()
  matchDate?: Date;

  @ApiProperty({ description: 'Bahis tipi - örn: Maç Sonucu, Alt/Üst 2.5' })
  @IsString()
  @IsNotEmpty()
  betType: string;

  @ApiProperty({ description: 'Tahmin - örn: 1, X, 2, Alt, Üst' })
  @IsString()
  @IsNotEmpty()
  prediction: string;

  @ApiProperty({ description: 'Oran' })
  @IsNumber()
  @Min(1)
  odds: number;
}

export class CreateCouponDto {
  @ApiProperty({ description: 'Kupon başlığı' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: 'Yatırılan miktar', minimum: 1 })
  @IsNumber()
  @Min(1)
  stakeAmount: number;

  @ApiPropertyOptional({ description: 'Genel (manuel girilen) Toplam Oran', minimum: 1.0 })
  @IsNumber()
  @IsOptional()
  @Min(1)
  customTotalOdds?: number;

  @ApiPropertyOptional({ description: 'Para birimi', default: 'TRY' })
  @IsString()
  @IsOptional()
  currency?: string;

  @ApiProperty({ description: 'Görünürlük', enum: ['PUBLIC', 'PRIVATE'] })
  @IsEnum(['PUBLIC', 'PRIVATE'])
  visibility: 'PUBLIC' | 'PRIVATE';

  @ApiProperty({ description: 'Maç seçimleri', type: [CreateSelectionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSelectionDto)
  selections: CreateSelectionDto[];
}

export class CreateCouponFromPhotoDto {
  @ApiPropertyOptional({ description: 'Kupon başlığı (AI çıkaramazsa kullanıcıdan istenir)' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({ description: 'Yatırılan miktar' })
  @IsNumber()
  @Min(1)
  stakeAmount: number;

  @ApiProperty({ description: 'Görünürlük', enum: ['PUBLIC', 'PRIVATE'] })
  @IsEnum(['PUBLIC', 'PRIVATE'])
  visibility: 'PUBLIC' | 'PRIVATE';
}
