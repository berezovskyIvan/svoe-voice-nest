import type { DemoRepository } from '../../persistence/demo-repository.js';
import { asLineItem, totalPriceOf } from '../../shared/catalog.js';
import { ERROR_CODE, reject } from '../../shared/errors.js';
import type { Product } from '../../shared/interfaces/index.js';
import {
  DELIVERY_ADDRESS,
  deliveryAvailable,
  resolveDelivery,
} from '../../shared/rules.js';
import type { OrderRequest } from '../action-requests.js';
import type { Action, OrderResult } from '../interfaces/index.js';

export async function prepareOrder(
  input: OrderRequest,
  store: DemoRepository,
): Promise<Action<OrderResult>> {
  const date = resolveOrderDate(input, new Date());
  const items = priceItems(
    input,
    await store.findProducts(input.items.map(({ id }) => id)),
  );
  const totalPrice = totalPriceOf(items);

  if (totalPrice !== input.expectedTotalPrice) {
    return reject(
      409,
      ERROR_CODE.PRICE_CHANGED,
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
        address: input.deliveryAddress ?? DELIVERY_ADDRESS,
        date,
        slot: input.deliverySlot,
      },
      items,
    },
    subtitle: items.map(({ name }) => name).join(', '),
    title: 'Заказ фермерских продуктов',
  };
}

function resolveOrderDate(input: OrderRequest, now: Date): string {
  const date = input.deliveryDate ?? resolveDelivery(null, null, now)?.date;

  if (!date || !deliveryAvailable(date, input.deliverySlot, now)) {
    return reject(
      409,
      ERROR_CODE.DELIVERY_UNAVAILABLE,
      'Время доставки недоступно',
    );
  }

  return date;
}

function priceItems(
  input: OrderRequest,
  products: Product[],
): ReturnType<typeof asLineItem>[] {
  const byId = new Map(products.map((product) => [product.id, product]));
  return input.items.map(({ id, qty }) => {
    const product = byId.get(id);

    if (!product) {
      return reject(
        404,
        ERROR_CODE.PRODUCT_NOT_FOUND,
        'Товар отсутствует в каталоге',
      );
    }

    return asLineItem(product, qty);
  });
}
