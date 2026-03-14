import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class TelegramLoginDto {
  @ApiProperty({ description: 'Telegram user ID' })
  @IsString()
  @IsNotEmpty()
  telegramId: string;

  @ApiPropertyOptional({ description: 'Telegram username' })
  @IsString()
  @IsOptional()
  username?: string;

  @ApiPropertyOptional({ description: 'First name' })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name' })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({ description: 'Profile photo URL' })
  @IsString()
  @IsOptional()
  photoUrl?: string;

  @ApiProperty({ description: 'Telegram auth hash for verification' })
  @IsString()
  @IsNotEmpty()
  hash: string;

  @ApiProperty({ description: 'Auth date timestamp' })
  @IsString()
  @IsNotEmpty()
  authDate: string;
}
