import { z } from 'zod';
import { lineItem } from '../shared/openapi.js';

const cart = z.object({
  intent: z.literal('farmer-products'),
  payload: z.object({
    delivery: z
      .object({
        address: z.string(),
        date: z.iso.date(),
        slot: z.string(),
      })
      .nullable(),
    deliveryIssue: z.literal('UNSUPPORTED_DELIVERY').nullable(),
    items: z.array(lineItem),
    totalPrice: z.int().nonnegative(),
    unmatchedItems: z.array(z.string()),
  }),
  recognizedText: z.string(),
});

const analytics = z.object({
  intent: z.literal('analytics'),
  payload: z.object({
    aiAdvice: z.string(),
    categories: z.array(
      z.object({
        amount: z.int().nonnegative(),
        code: z.string(),
        name: z.string(),
        percent: z.int().min(0).max(100),
      }),
    ),
    depositOffer: z.object({
      accountBalance: z.int().nonnegative(),
      currency: z.literal('RUB'),
      defaultAmount: z.int().nullable(),
      maxAmount: z.int().positive(),
      minAmount: z.int().positive(),
      rate: z.literal(14),
      termMonths: z.literal(6),
    }),
    period: z.string().regex(/^\d{4}-\d{2}$/),
    totalSpent: z.int().nonnegative(),
  }),
  recognizedText: z.string(),
});

const unknown = z.object({
  intent: z.literal('unknown'),
  message: z.string(),
  recognizedText: z.string(),
});

export const assistantResponse = z.discriminatedUnion('intent', [
  cart,
  analytics,
  unknown,
]);
