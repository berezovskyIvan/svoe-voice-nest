import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Analytics } from './analytics.service.js';
import { AssistantService } from './assistant.service.js';
import {
  databaseOptions,
  DemoDatabase,
} from '../persistence/demo-database.service.js';
import { DemoRepository } from '../persistence/demo-repository.js';
import { YandexLanguageModel } from './yandex-language-model.service.js';

describe('AssistantService', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('accepts the weekday and quantities returned by YandexGPT for the demo order', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-20T12:00:00Z'));

    const source = new DataSource(databaseOptions());
    const config = new ConfigService();
    const database = new DemoDatabase(config, source);
    const model = new YandexLanguageModel(config);
    const store = new DemoRepository(source.manager);
    vi.spyOn(database, 'read').mockResolvedValue(store);
    vi.spyOn(model, 'complete').mockResolvedValue(
      JSON.stringify({
        intent: 'farmer-products',
        items: [
          { name: 'молоко', variant: '3,2%', quantity: null, unit: 'l' },
          { name: 'яйца', quantity: '10', unit: 'piece' },
        ],
        deliveryDay: 'Saturday',
        deliveryTime: 'morning',
      }),
    );
    vi.spyOn(store, 'findProducts').mockResolvedValue([
      {
        id: 1,
        name: 'Молоко 3,2%',
        unitLabel: '1 л',
        packSize: 1000,
        packUnit: 'ml',
        price: 129,
        imageUrl: '',
        keywords: ['молоко'],
      },
      {
        id: 3,
        name: 'Яйца С0',
        unitLabel: '10 шт',
        packSize: 10,
        packUnit: 'piece',
        price: 149,
        imageUrl: '',
        keywords: ['яйца'],
      },
    ]);

    await expect(
      new AssistantService(
        new Analytics(database, model),
        database,
        model,
      ).process('Закажи молоко и десяток яиц на субботу утром'),
    ).resolves.toMatchObject({
      intent: 'farmer-products',
      payload: {
        items: [
          { id: 1, qty: 1 },
          { id: 3, qty: 1 },
        ],
        totalPrice: 278,
        unmatchedItems: [],
        delivery: {
          address: 'ул. Красная, 122',
          date: '2026-11-21',
          slot: '09:00-12:00',
        },
      },
    });
  });
});
