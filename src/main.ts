import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Güvenlik
  app.use(helmet());
  app.enableCors({
    origin: '*', // Production'da kısıtlanmalı
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // API Prefix
  app.setGlobalPrefix('api/v1');

  // Swagger Dokümantasyonu
  const config = new DocumentBuilder()
    .setTitle('Kupon Merkezi API')
    .setDescription('Spor bahis kuponu takip uygulaması REST API')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Kimlik doğrulama ve Telegram entegrasyonu')
    .addTag('coupons', 'Kupon oluşturma ve yönetimi')
    .addTag('communities', 'Topluluk yönetimi')
    .addTag('leaderboard', 'Liderlik tablosu')
    .addTag('statistics', 'İstatistikler ve finansal takip')
    .addTag('live', 'Canlı takip')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`🏆 Kupon Merkezi API is running on: http://localhost:${port}`);
  console.log(`📚 Swagger docs: http://localhost:${port}/api/docs`);
}
bootstrap();
