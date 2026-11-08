import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  const config = new DocumentBuilder()
    .setTitle('Svoe Voice API')
    .setDescription('Документация API для хакатона Svoe Voice')
    .setVersion('1.0')
    .addTag('voice')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  
  SwaggerModule.setup('', app, document);

  await app.listen(process.env.PORT ?? 8080);
}
await bootstrap();
