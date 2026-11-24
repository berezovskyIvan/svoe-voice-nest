import { z } from 'zod';
import { deposit } from '../shared/rules.js';
import { lineItem } from '../shared/openapi.js';
import type { AssistantResult } from './interfaces/index.js';
import { depositPayload } from './assistant-response.js';
import { RESPONSE_STATUS } from '../shared/api-contract.js';
import {
  ASSISTANT_INTENT,
  ORIGINAL_MARKET_INTENT,
} from './assistant-intent-values.js';

export const originalNoSpeech = {
  status: RESPONSE_STATUS.error,
  message: 'Не расслышал. Повторите, пожалуйста',
};

const marketResponse = z.object({
  status: z.literal(RESPONSE_STATUS.success),
  intent: z.literal(ORIGINAL_MARKET_INTENT),
  recognizedText: z.string(),
  payload: z.object({
    items: z.array(lineItem.omit({ unitLabel: true })),
    delivery: z
      .object({ date: z.string(), slot: z.string(), address: z.string() })
      .nullable(),
  }),
});
const analyticsResponse = z.object({
  status: z.literal(RESPONSE_STATUS.success),
  intent: z.literal(ASSISTANT_INTENT.analytics),
  recognizedText: z.string(),
  payload: z.object({
    totalSpent: z.int(),
    categories: z.array(
      z.object({ amount: z.int(), name: z.string(), percent: z.int() }),
    ),
    aiAdvice: z.string(),
    depositOffer: z.object({
      accountBalance: z.int(),
      defaultAmount: z.int().nullable(),
      rate: z.literal(deposit.rate),
    }),
  }),
});

export const originalAssistantResponse = z.union([
  marketResponse,
  analyticsResponse,
  z.object({
    status: z.literal(RESPONSE_STATUS.success),
    intent: z.literal(ASSISTANT_INTENT.deposit),
    recognizedText: z.string(),
    payload: depositPayload,
  }),
  z.object({
    status: z.literal(RESPONSE_STATUS.error),
    message: z.literal(originalNoSpeech.message),
  }),
]);

const deliveryDate = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'Europe/Moscow',
});

export function toOriginalAssistantResponse(
  result: AssistantResult,
): z.infer<typeof originalAssistantResponse> {
  if (result.intent === ASSISTANT_INTENT.unknown) {
    return originalNoSpeech;
  }
  const { recognizedText } = result;
  const status = RESPONSE_STATUS.success;
  if (result.intent === ASSISTANT_INTENT.deposit) {
    return { status, ...result };
  }
  if (result.intent === ASSISTANT_INTENT.analytics) {
    const { totalSpent, categories, aiAdvice, depositOffer } = result.payload;
    const { accountBalance, defaultAmount, rate } = depositOffer;
    return {
      status,
      intent: ASSISTANT_INTENT.analytics,
      recognizedText,
      payload: {
        totalSpent,
        categories: categories.map(({ amount, name, percent }) => ({
          amount,
          name,
          percent,
        })),
        aiAdvice,
        depositOffer: { accountBalance, defaultAmount, rate },
      },
    };
  }
  const { delivery, items } = result.payload;
  const date = delivery && deliveryDate.format(new Date(delivery.date));
  return {
    status,
    intent: ORIGINAL_MARKET_INTENT,
    recognizedText,
    payload: {
      items: items.map(({ id, name, qty, price, imageUrl }) => ({
        id,
        name,
        qty,
        price,
        imageUrl,
      })),
      delivery:
        delivery && date
          ? {
              date: date[0].toUpperCase() + date.slice(1),
              slot: delivery.slot.replace('-', ' - '),
              address: delivery.address,
            }
          : null,
    },
  };
}
