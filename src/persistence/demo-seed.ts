import type { EntityManager } from 'typeorm';
import { HISTORY_TYPE } from '../shared/history-types.js';
import {
  DEMO_ACCOUNT_ID,
  monthBounds,
  STARTING_BALANCE,
} from '../shared/rules.js';
import { DEMO_MODE, type DemoMode } from './demo-mode.js';
import { demoProducts } from './demo-products.js';
import { DemoRepository } from './demo-repository.js';

export async function seedDemoData(
  manager: EntityManager,
  mode: DemoMode,
): Promise<void> {
  const store = new DemoRepository(manager);

  if (mode === DEMO_MODE.seed) {
    await manager
      .createQueryBuilder()
      .insert()
      .into('products', [
        'category',
        'id',
        'imageUrl',
        'keywords',
        'name',
        'packSize',
        'packUnit',
        'price',
        'unitLabel',
      ])
      .values(demoProducts)
      .orIgnore()
      .execute();
  }
  const insert = await manager
    .createQueryBuilder()
    .insert()
    .into('accounts')
    .values({
      balance: STARTING_BALANCE,
      id: DEMO_ACCOUNT_ID,
      userName: 'Екатерина',
    })
    .orIgnore()
    .returning('id')
    .execute();

  if ((insert.raw as unknown[]).length === 0 && mode === DEMO_MODE.seed) {
    return;
  }

  await store.findAccount(true);

  if (mode !== DEMO_MODE.seed) {
    await store.updateBalance(STARTING_BALANCE);
    await manager
      .createQueryBuilder()
      .delete()
      .from('assistant_history')
      .execute();

    if (mode === DEMO_MODE.reset) {
      await manager
        .createQueryBuilder()
        .delete()
        .from('transactions')
        .execute();
    }
  }

  if (mode !== DEMO_MODE.resetHistory) {
    await insertDemoSpending(manager);
  }

  await insertDemoHistory(manager);
}

async function insertDemoSpending(manager: EntityManager): Promise<void> {
  const { start } = monthBounds(new Date());
  await manager
    .createQueryBuilder()
    .insert()
    .into('transactions', ['amount', 'category', 'date'])
    .values([
      { amount: 42000, category: 'cafes', date: start },
      { amount: 23625, category: 'groceries', date: start },
      { amount: 14000, category: 'transport', date: start },
      { amount: 7875, category: 'pharmacies', date: start },
    ])
    .execute();
}

async function insertDemoHistory(manager: EntityManager): Promise<void> {
  await manager
    .createQueryBuilder()
    .insert()
    .into('assistant_history', [
      'amount',
      'createdAt',
      'subtitle',
      'title',
      'type',
    ])
    .values([
      {
        amount: 3500,
        createdAt: () => "now() - interval '4 days'",
        subtitle: 'Александру К.',
        title: 'Перевод по СБП',
        type: HISTORY_TYPE.demo,
      },
      {
        amount: 6420,
        createdAt: () => "now() - interval '3 days'",
        subtitle: 'Оплачено',
        title: 'Оплата ЖКХ за октябрь',
        type: HISTORY_TYPE.demo,
      },
      {
        amount: 5000,
        createdAt: () => "now() - interval '2 days'",
        subtitle: 'Оплачено',
        title: 'Покупка билетов на концерт',
        type: HISTORY_TYPE.demo,
      },
      {
        amount: null,
        createdAt: () => "now() - interval '1 day'",
        subtitle: 'Демонстрационная запись',
        title: 'Аналитика трат за прошлый месяц',
        type: HISTORY_TYPE.demo,
      },
    ])
    .execute();
}
