import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Analytics } from '../../src/assistant/analytics.service.js';
import { ProcessTextHandler } from '../../src/assistant/commands/handlers/process-text.handler.js';
import { ProcessTextCommand } from '../../src/assistant/commands/process-text.command.js';
import {
  databaseOptions,
  DemoDatabase,
} from '../../src/persistence/demo-database.service.js';
import { DemoRepository } from '../../src/persistence/demo-repository.js';
import { PRODUCT_UNITS } from '../../src/shared/product-units.js';
import { YandexLanguageModel } from '../../src/assistant/yandex-language-model.service.js';

describe('ProcessTextHandler', () => {
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
          {
            name: 'молоко',
            variant: '3,2%',
            quantity: null,
            unit: PRODUCT_UNITS.liter,
          },
          { name: 'яйца', quantity: '10', unit: PRODUCT_UNITS.piece },
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
        packUnit: PRODUCT_UNITS.milliliter,
        price: 129,
        imageUrl: '',
        keywords: ['молоко'],
      },
      {
        id: 3,
        name: 'Яйца С0',
        unitLabel: '10 шт',
        packSize: 10,
        packUnit: PRODUCT_UNITS.piece,
        price: 149,
        imageUrl: '',
        keywords: ['яйца'],
      },
    ]);

    await expect(
      new ProcessTextHandler(
        new Analytics(database, model),
        database,
        model,
      ).execute(
        new ProcessTextCommand('Закажи молоко и десяток яиц на субботу утром'),
      ),
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
