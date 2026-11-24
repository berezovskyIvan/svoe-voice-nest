import { z } from 'zod';
import {
  DELIVERY_DAY,
  DELIVERY_TIME,
  weekdays,
} from '../shared/delivery-options.js';
import { PRODUCT_UNITS } from '../shared/product-units.js';
import { deliveryAddressSchema, isDate } from '../shared/rules.js';
import { ASSISTANT_INTENT } from './assistant-intent-values.js';

export const parseIntent = z.discriminatedUnion('intent', [
  z.object({
    intent: z.literal(ASSISTANT_INTENT.farmerProducts),
    items: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(120),
          variant: z.string().trim().max(80).nullable().default(null),
          quantity: z
            .union([
              z.number(),
              z
                .string()
                .trim()
                .regex(/^\d+(?:[.,]\d+)?$/)
                .transform((value) => value.replace(',', '.'))
                .pipe(z.coerce.number()),
            ])
            .pipe(z.number().positive().max(100_000))
            .nullable()
            .default(null),
          unit: z.enum(PRODUCT_UNITS).nullable().default(null),
        }),
      )
      .max(30),
    deliveryDay: z
      .string()
      .trim()
      .toLowerCase()
      .refine(
        (value) =>
          [
            DELIVERY_DAY.today,
            DELIVERY_DAY.tomorrow,
            ...weekdays,
            DELIVERY_DAY.unsupported,
          ].includes(value) || isDate(value),
      )
      .nullable()
      .default(null),
    deliveryTime: z.enum(DELIVERY_TIME).nullable().default(null),
    deliveryAddress: deliveryAddressSchema.nullable().default(null),
  }),
  z.object({ intent: z.literal(ASSISTANT_INTENT.analytics) }),
  z.object({
    intent: z.literal(ASSISTANT_INTENT.deposit),
    amount: z.number().nullable().default(null),
  }),
  z.object({ intent: z.literal(ASSISTANT_INTENT.unknown) }),
]);

export type AssistantIntent = z.infer<typeof parseIntent>;
