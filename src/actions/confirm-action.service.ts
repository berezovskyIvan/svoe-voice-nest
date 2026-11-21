import { Injectable } from '@nestjs/common';
import { DemoDatabase } from '../persistence/demo-database.service.js';
import type { DemoRepository } from '../persistence/demo-repository.js';
import { reject } from '../shared/errors.js';

interface Action<T> {
  amount: number;
  response: (historyId: number, newBalance: number) => T;
  snapshot: object;
  subtitle: string;
  title: string;
}

@Injectable()
export class ConfirmAction {
  constructor(private readonly database: DemoDatabase) {}

  execute<T extends object>(input: {
    key: string;
    prepare: (store: DemoRepository) => Action<T> | Promise<Action<T>>;
    request: object;
    type: 'order' | 'deposit';
  }): Promise<T> {
    return this.database.transaction(async (store) => {
      const { balance } = await store.findAccount(true);
      const { key, request, type } = input;
      const existing = await store.findConfirmation<T>({ key, request, type });
      if (existing) {
        if (!existing.matches)
          return reject(
            409,
            'IDEMPOTENCY_CONFLICT',
            'Подтверждение уже использовано',
          );
        return existing.response;
      }
      const action = await input.prepare(store);
      const newBalance = balance - action.amount;
      if (newBalance < 0)
        return reject(409, 'INSUFFICIENT_FUNDS', 'Недостаточно средств');
      await store.updateBalance(newBalance);
      const historyId = await store.insertHistory({
        amount: action.amount,
        confirmation_key: key,
        request: JSON.stringify(request),
        snapshot: JSON.stringify(action.snapshot),
        subtitle: action.subtitle,
        title: action.title,
        type,
      });
      const response = action.response(historyId, newBalance);
      await store.updateConfirmation(historyId, response);
      return response;
    });
  }
}
