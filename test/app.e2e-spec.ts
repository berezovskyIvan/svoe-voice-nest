import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    SwaggerModule.setup(
      '',
      app,
      SwaggerModule.createDocument(app, new DocumentBuilder().build()),
      { jsonDocumentUrl: '/openapi.json' },
    );
    await app.init();
  });

  it('/hello (GET)', () => {
    return request(app.getHttpServer())
      .get('/hello')
      .expect(200)
      .expect('Hello World!');
  });

  it('serves catalog images alongside Swagger', async () => {
    const api = request(app.getHttpServer());
    await api
      .get('/static/products/100.webp')
      .expect(200)
      .expect('Content-Type', /image\/webp/);
    await api.get('/static/products/missing.webp').expect(404);
  });

  it('documents all six MVP HTTP routes and the voice upload', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/openapi.json')
      .expect(200);
    expect(
      Object.keys(body.paths)
        .filter((path) => path.startsWith('/api/'))
        .sort(),
    ).toEqual([
      '/api/actions/deposit',
      '/api/actions/history',
      '/api/actions/order',
      '/api/actions/reset',
      '/api/assistant/text',
      '/api/assistant/voice',
    ]);
    expect(
      body.paths['/api/assistant/voice'].post.requestBody.content[
        'multipart/form-data'
      ].schema.properties.file.format,
    ).toBe('binary');
  });

  afterEach(async () => {
    await app.close();
  });
});
