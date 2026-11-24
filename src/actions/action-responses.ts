import { z } from 'zod';
import { deposit } from '../shared/rules.js';
import { DEMO_RESET_MESSAGE, RESPONSE_STATUS } from '../shared/api-contract.js';
import {
  HISTORY_TYPE,
  ORIGINAL_HISTORY_TYPE,
} from '../shared/history-types.js';

export const depositResponse = z.object({
  amount: z.int().positive(),
  currency: z.literal(deposit.currency),
  depositId: z.int().positive(),
  estimatedInterest: z.int().nonnegative(),
  estimatedTotal: z.int().positive(),
  newBalance: z.int().nonnegative(),
  rate: z.literal(deposit.rate),
  termMonths: z.literal(deposit.termMonths),
});

export const historyResponse = z.object({
  balance: z.int().nonnegative(),
  history: z.array(
    z.object({
      amount: z.int().nullable(),
      createdAt: z.iso.datetime(),
      id: z.int().positive(),
      subtitle: z.string(),
      title: z.string(),
      type: z.enum([
        HISTORY_TYPE.analytics,
        HISTORY_TYPE.demo,
        HISTORY_TYPE.deposit,
        HISTORY_TYPE.order,
      ]),
    }),
  ),
  user: z.object({ name: z.string() }),
});

export const orderResponse = z.object({
  newBalance: z.int().nonnegative(),
  orderId: z.int().positive(),
  totalPrice: z.int().positive(),
});

export const originalHistoryResponse = historyResponse
  .omit({ user: true })
  .extend({
    history: z.array(
      historyResponse.shape.history.element.extend({
        type: z.enum([
          ORIGINAL_HISTORY_TYPE.market,
          ORIGINAL_HISTORY_TYPE.analytics,
          ORIGINAL_HISTORY_TYPE.transfer,
        ]),
      }),
    ),
  });

export const originalActionResponse = z.object({
  status: z.literal(RESPONSE_STATUS.ok),
  newBalance: z.int().nonnegative(),
});

export const resetResponse = z.object({
  status: z.literal(RESPONSE_STATUS.ok),
  message: z.literal(DEMO_RESET_MESSAGE),
});
