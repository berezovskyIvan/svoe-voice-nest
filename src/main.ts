import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { VoiceEndpoint } from './voice/voice-endpoint.service.js';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  const origins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
  const frontendOrigin = configService.get<string>('FRONTEND_ORIGIN');
  if (frontendOrigin) origins.push(frontendOrigin);
  app.enableCors({ origin: origins });
  const voice = app.get(VoiceEndpoint);
  voice.attach(app.getHttpServer(), origins);
  app.enableShutdownHooks();

  const config = new DocumentBuilder()
    .setTitle('Svoe Voice API')
    .setDescription('Документация API для хакатона Svoe Voice')
    .setVersion('1.0')
    .addTag('assistant')
    .addTag('actions')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('', app, document, { jsonDocumentUrl: '/openapi.json' });

  await app.listen(
    configService.get<string>('PORT') ?? 8080,
    configService.get<string>('HOST') ?? '127.0.0.1',
  );
}
await bootstrap();
