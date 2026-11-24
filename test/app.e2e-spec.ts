import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { UploadedSpeech } from '../src/assistant/uploaded-speech.service.js';
import { YandexLanguageModel } from '../src/assistant/yandex-language-model.service.js';
import { DemoDatabase } from '../src/persistence/demo-database.service.js';
import { DemoRepository } from '../src/persistence/demo-repository.js';
import { DataSource } from 'typeorm';
import { demoProducts } from '../src/persistence/demo-products.js';
import { resolveDelivery } from '../src/shared/rules.js';

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

  it('returns a deposit offer for a text command or voice transcript without opening the deposit', async () => {
    const database = app.get(DemoDatabase);
    const store = new DemoRepository(app.get(DataSource).manager);
    vi.spyOn(database, 'read').mockResolvedValue(store);
    vi.spyOn(store, 'findAccount').mockResolvedValue({
      balance: 150_000,
      name: 'Зоя',
    });
    const transaction = vi.spyOn(database, 'transaction');
    const insertHistory = vi.spyOn(store, 'insertHistory');
    const complete = vi.spyOn(app.get(YandexLanguageModel), 'complete');
    complete.mockResolvedValue('{"intent":"deposit","amount":200000}');
    const text = 'Открой вклад на двести тысяч рублей';
    vi.spyOn(app.get(UploadedSpeech), 'recognize').mockResolvedValue(text);
    const api = request(app.getHttpServer());
    const expected = {
      intent: 'deposit',
      recognizedText: text,
      payload: {
        requestedAmount: 200_000,
        depositOffer: {
          accountBalance: 150_000,
          currency: 'RUB',
          defaultAmount: 150_000,
          maxAmount: 10_000_000,
          minAmount: 500,
          rate: 14,
          termMonths: 6,
        },
      },
    };
    await api
      .post('/api/assistant/text')
      .set('X-Zoya-Contract', 'nuxt')
      .send({ text })
      .expect(200, expected);
    await api
      .post('/api/assistant/text')
      .send({ text })
      .expect(200, { status: 'success', ...expected });
    await api
      .post('/api/assistant/voice')
      .attach('file', Buffer.from('audio'), 'command.webm')
      .expect(200, { status: 'success', ...expected });

    complete.mockResolvedValue('{"intent":"deposit","amount":null}');
    await api
      .post('/api/assistant/text')
      .set('X-Zoya-Contract', 'nuxt')
      .send({ text: 'Хочу открыть вклад' })
      .expect(200, {
        ...expected,
        recognizedText: 'Хочу открыть вклад',
        payload: { ...expected.payload, requestedAmount: null },
      });
    expect(transaction).not.toHaveBeenCalled();
    expect(insertHistory).not.toHaveBeenCalled();
  });

  it('carries the address from a voice order through confirmation', async () => {
    const database = app.get(DemoDatabase);
    const store = new DemoRepository(app.get(DataSource).manager);
    vi.spyOn(database, 'read').mockResolvedValue(store);
    vi.spyOn(database, 'transaction').mockImplementation((work) => work(store));
    vi.spyOn(store, 'findProducts').mockResolvedValue(demoProducts.slice(0, 1));
    vi.spyOn(store, 'findAccount').mockResolvedValue({
      balance: 180_000,
      name: 'Екатерина',
    });
    vi.spyOn(store, 'findConfirmation').mockResolvedValue(undefined);
    vi.spyOn(store, 'updateBalance').mockResolvedValue(undefined);
    vi.spyOn(store, 'updateConfirmation').mockResolvedValue(undefined);
    const insertHistory = vi.spyOn(store, 'insertHistory').mockResolvedValue(6);
    const text =
      'Привези молоко 21 ноября 2099 года утром на улицу Садовую, дом пятнадцать';
    const address = 'ул. Садовая, 15';
    const date = '2099-11-21';
    vi.spyOn(app.get(UploadedSpeech), 'recognize').mockResolvedValue(text);
    vi.spyOn(app.get(YandexLanguageModel), 'complete').mockResolvedValue(
      JSON.stringify({
        intent: 'farmer-products',
        items: [{ name: 'молоко', variant: '3,2%' }],
        deliveryDay: date,
        deliveryTime: 'morning',
        deliveryAddress: address,
      }),
    );

    const api = request(app.getHttpServer());
    const { body: voice } = await api
      .post('/api/assistant/voice')
      .attach('file', Buffer.from('audio'), 'command.webm')
      .expect(200);
    expect(voice.payload.delivery.address).toBe(address);
    const { body: draft } = await api
      .post('/api/assistant/text')
      .set('X-Zoya-Contract', 'nuxt')
      .send({ text })
      .expect(200);
    const { delivery, totalPrice } = draft.payload;
    expect(delivery.address).toBe(address);
    expect(delivery.date).toBe(date);
    const items = [{ id: demoProducts[0].id, qty: 1 }];
    await api
      .post('/api/actions/order')
      .set('Idempotency-Key', randomUUID())
      .send({
        items,
        expectedTotalPrice: totalPrice,
        deliveryDate: delivery.date,
        deliverySlot: delivery.slot,
        deliveryAddress: delivery.address,
      })
      .expect(200);
    const originalRequest = {
      items,
      totalPrice,
      deliverySlot: voice.payload.delivery.slot,
      deliveryAddress: voice.payload.delivery.address,
    };
    await api
      .post('/api/actions/order')
      .send({ ...originalRequest, deliveryDate: date })
      .expect(200);
    await api.post('/api/actions/order').send(originalRequest).expect(200);
    await api
      .post('/api/actions/order')
      .send({ ...originalRequest, deliveryDate: '2000-01-01' })
      .expect(409);
    const expectedDates = [
      date,
      date,
      resolveDelivery(null, null, new Date())?.date,
    ];
    expect(insertHistory).toHaveBeenCalledTimes(expectedDates.length);
    for (const [index, [order]] of insertHistory.mock.calls.entries()) {
      assert.ok(order.snapshot);
      expect(JSON.parse(order.snapshot)).toMatchObject({
        delivery: { address, date: expectedDates[index] },
      });
    }
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await app.close();
  });
});
