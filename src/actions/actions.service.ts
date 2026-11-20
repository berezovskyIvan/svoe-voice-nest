import { Injectable } from '@nestjs/common';
import type { OrderRequest } from './action-requests.js';
import { asLineItem, type Product } from '../shared/catalog.js';
import { ConfirmAction } from './confirm-action.service.js';
import { DemoDatabase } from '../persistence/demo-database.service.js';
import type { HistoryEntry } from '../persistence/demo-repository.js';
import { reject } from '../shared/errors.js';
import {
  DELIVERY_ADDRESS,
  deliveryAvailable,
  deposit,
  resolveDelivery,
} from '../shared/rules.js';

export interface DepositResult {
  amount: number;
  currency: string;
  depositId: number;
  estimatedInterest: number;
  estimatedTotal: number;
  newBalance: number;
  rate: number;
  termMonths: number;
}

export interface OrderResult {
  newBalance: number;
  orderId: number;
  totalPrice: number;
}

export interface HistoryResult {
  balance: number;
  history: HistoryEntry[];
  user: { name: string };
}

@Injectable()
export class ActionsService {
  constructor(
    private readonly confirmation: ConfirmAction,
    private readonly database: DemoDatabase,
  ) {}

  history(): Promise<HistoryResult> {
    return this.database.transaction(async (store) => {
      const { balance, name } = await store.findAccount();
      return { balance, history: await store.findHistory(), user: { name } };
    }, 'REPEATABLE READ');
  }

  openDeposit(amount: number, key: string): Promise<DepositResult> {
    const { currency, rate, termMonths } = deposit;
    const estimatedInterest = Math.round((amount * rate * termMonths) / 1200);
    const offer = {
      amount,
      currency,
      estimatedInterest,
      estimatedTotal: amount + estimatedInterest,
      rate,
      termMonths,
    };
    return this.confirmation.execute({
      key,
      prepare: () => ({
        amount,
        response: (depositId, newBalance) => ({
          depositId,
          ...offer,
          newBalance,
        }),
        snapshot: offer,
        subtitle: `На срок ${termMonths} мес.`,
        title: `Открытие вклада под ${rate}%`,
      }),
      request: { amount },
      type: 'deposit',
    });
  }

  order(input: OrderRequest, key: string): Promise<OrderResult> {
    const request = {
      ...input,
      items: [...input.items].sort((left, right) => left.id - right.id),
    };
    return this.confirmation.execute({
      key,
      prepare: async (store) => {
        const now = new Date();
        const date =
          input.deliveryDate ?? resolveDelivery(null, null, now)?.date;
        if (!date || !deliveryAvailable(date, input.deliverySlot, now)) {
          return reject(
            409,
            'DELIVERY_UNAVAILABLE',
            'Время доставки недоступно',
          );
        }
        const items = this.priceItems(
          input,
          await store.findProducts(input.items.map(({ id }) => id)),
        );
        const totalPrice = items.reduce(
          (sum, item) => sum + item.price * item.qty,
          0,
        );
        if (totalPrice !== input.expectedTotalPrice) {
          return reject(
            409,
            'PRICE_CHANGED',
            'Проверьте обновлённую сумму заказа',
            { items, totalPrice },
          );
        }
        return {
          amount: totalPrice,
          response: (orderId, newBalance) => ({
            newBalance,
            orderId,
            totalPrice,
          }),
          snapshot: {
            delivery: {
              address: DELIVERY_ADDRESS,
              date,
              slot: input.deliverySlot,
            },
            items,
          },
          subtitle: items.map(({ name }) => name).join(', '),
          title: 'Заказ фермерских продуктов',
        };
      },
      request,
      type: 'order',
    });
  }

  private priceItems(input: OrderRequest, products: Product[]) {
    const byId = new Map(products.map((product) => [product.id, product]));
    return input.items.map(({ id, qty }) => {
      const product = byId.get(id);
      if (!product)
        return reject(404, 'PRODUCT_NOT_FOUND', 'Товар отсутствует в каталоге');
      return asLineItem(product, qty);
    });
  }
}
