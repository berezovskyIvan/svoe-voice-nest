import { z } from 'zod';
import { isDate } from '../shared/rules.js';

export const parseIntent = z.discriminatedUnion('intent', [
  z.object({
    intent: z.literal('farmer-products'),
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
          unit: z
            .enum(['pack', 'piece', 'g', 'kg', 'ml', 'l'])
            .nullable()
            .default(null),
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
            'today',
            'tomorrow',
            'sunday',
            'monday',
            'tuesday',
            'wednesday',
            'thursday',
            'friday',
            'saturday',
            'unsupported',
          ].includes(value) || isDate(value),
      )
      .nullable()
      .default(null),
    deliveryTime: z.enum(['morning', 'unsupported']).nullable().default(null),
  }),
  z.object({ intent: z.literal('analytics') }),
  z.object({
    intent: z.literal('deposit'),
    amount: z.number().nullable().default(null),
  }),
  z.object({ intent: z.literal('unknown') }),
]);

export type AssistantIntent = z.infer<typeof parseIntent>;
