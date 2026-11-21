import { z } from 'zod';

export const depositResponse = z.object({
  amount: z.int().positive(),
  currency: z.literal('RUB'),
  depositId: z.int().positive(),
  estimatedInterest: z.int().nonnegative(),
  estimatedTotal: z.int().positive(),
  newBalance: z.int().nonnegative(),
  rate: z.literal(14),
  termMonths: z.literal(6),
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
      type: z.enum(['analytics', 'demo', 'deposit', 'order']),
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
        type: z.enum(['market', 'analytics', 'transfer']),
      }),
    ),
  });

export const originalActionResponse = z.object({
  status: z.literal('ok'),
  newBalance: z.int().nonnegative(),
});

export const resetResponse = z.object({
  status: z.literal('ok'),
  message: z.literal('Demo reset completed'),
});
