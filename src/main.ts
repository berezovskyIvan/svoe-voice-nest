import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Server } from 'node:http';
import { AppModule } from './app.module.js';
import { VoiceEndpoint } from './voice/voice-endpoint.service.js';

async function bootstrap() {
  const app = await NestFactory.create<INestApplication<Server>>(AppModule);
  const config = app.get(ConfigService);

  const allowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
  const frontendOrigin = config.get<string>('FRONTEND_ORIGIN');

  if (frontendOrigin) {
    allowedOrigins.push(frontendOrigin);
  }

  app.enableCors({ origin: allowedOrigins });
  app.get(VoiceEndpoint).attach(app.getHttpServer(), allowedOrigins);
  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Svoe Voice API')
    .setDescription('Документация API для хакатона Svoe Voice')
    .setVersion('1.0')
    .addTag('assistant')
    .addTag('actions')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('', app, document, { jsonDocumentUrl: '/openapi.json' });

  await app.listen(
    config.get<string>('PORT') ?? 8080,
    config.get<string>('HOST') ?? '127.0.0.1',
  );
}
await bootstrap();
