import { z } from 'zod';
import { deposit as depositTerms } from '../shared/rules.js';
import { lineItem } from '../shared/openapi.js';
import { DELIVERY_ISSUE } from '../shared/delivery-options.js';
import { ASSISTANT_INTENT } from './assistant-intent-values.js';

const cart = z.object({
  intent: z.literal(ASSISTANT_INTENT.farmerProducts),
  payload: z.object({
    delivery: z
      .object({
        address: z.string(),
        date: z.iso.date(),
        slot: z.string(),
      })
      .nullable(),
    deliveryIssue: z.literal(DELIVERY_ISSUE.unsupported).nullable(),
    items: z.array(lineItem),
    totalPrice: z.int().nonnegative(),
    unmatchedItems: z.array(z.string()),
  }),
  recognizedText: z.string(),
});

const depositOffer = z.object({
  accountBalance: z.int().nonnegative(),
  currency: z.literal(depositTerms.currency),
  defaultAmount: z.int().nullable(),
  maxAmount: z.int().positive(),
  minAmount: z.int().positive(),
  rate: z.literal(depositTerms.rate),
  termMonths: z.literal(depositTerms.termMonths),
});

export const depositPayload = z.object({
  depositOffer,
  requestedAmount: z.number().nullable(),
});

const deposit = z.object({
  intent: z.literal(ASSISTANT_INTENT.deposit),
  payload: depositPayload,
  recognizedText: z.string(),
});

const analytics = z.object({
  intent: z.literal(ASSISTANT_INTENT.analytics),
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
    depositOffer,
    period: z.string().regex(/^\d{4}-\d{2}$/),
    totalSpent: z.int().nonnegative(),
  }),
  recognizedText: z.string(),
});

const unknown = z.object({
  intent: z.literal(ASSISTANT_INTENT.unknown),
  message: z.string(),
  recognizedText: z.string(),
});

export const assistantResponse = z.discriminatedUnion('intent', [
  cart,
  analytics,
  deposit,
  unknown,
]);
