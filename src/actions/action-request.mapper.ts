import { randomUUID } from 'node:crypto';
import { invalid } from '../shared/errors.js';
import { DELIVERY_SLOT } from '../shared/rules.js';
import {
  confirmationKey,
  depositBody,
  orderBody,
  type OrderRequest,
  originalDepositBody,
  originalOrderBody,
} from './action-requests.js';

type ParsedAction<T> = { input: T; isOriginal: boolean; key: string };

function parseKey(key: unknown): string {
  const parsed = confirmationKey.safeParse(key);

  if (!parsed.success) {
    return invalid();
  }

  return parsed.data;
}

function originalKey(key: unknown): string {
  return key === undefined ? randomUUID() : parseKey(key);
}

export function parseDepositRequest(
  body: unknown,
  key: unknown,
): ParsedAction<number> {
  const input = depositBody.safeParse(body);

  if (input.success) {
    return {
      input: input.data.amount,
      key: parseKey(key),
      isOriginal: false,
    };
  }

  const original = originalDepositBody.safeParse(body);

  if (!original.success) {
    return invalid();
  }

  return {
    input: original.data.amount,
    key: originalKey(key),
    isOriginal: true,
  };
}

export function parseOrderRequest(
  body: unknown,
  key: unknown,
): ParsedAction<OrderRequest> {
  const input = orderBody.safeParse(body);

  if (input.success) {
    return {
      input: input.data,
      key: parseKey(key),
      isOriginal: false,
    };
  }

  const original = originalOrderBody.safeParse(body);

  if (!original.success) {
    return invalid();
  }

  const { deliveryAddress, deliveryDate, items, totalPrice } = original.data;

  return {
    input: {
      deliveryAddress,
      deliveryDate,
      deliverySlot: DELIVERY_SLOT,
      expectedTotalPrice: totalPrice,
      items,
    },
    key: originalKey(key),
    isOriginal: true,
  };
}
