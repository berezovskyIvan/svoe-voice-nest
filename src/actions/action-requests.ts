import { z } from 'zod';
import { deliveryAddressSchema, deposit } from '../shared/rules.js';

export const orderBody = z
  .strictObject({
    items: z
      .array(
        z.strictObject({
          id: z.number().int().min(1).max(2_147_483_647),
          qty: z.number().int().min(1).max(100),
        }),
      )
      .min(1)
      .max(100),
    expectedTotalPrice: z
      .number()
      .int()
      .positive()
      .max(Number.MAX_SAFE_INTEGER),
    deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    deliverySlot: z.string().min(1).max(32),
    deliveryAddress: deliveryAddressSchema.optional(),
  })
  .refine(
    ({ items }) => new Set(items.map(({ id }) => id)).size === items.length,
  );
export const depositBody = z.strictObject({
  amount: z.number().int().min(deposit.minAmount).max(deposit.maxAmount),
});
export const originalOrderBody = z
  .strictObject({
    items: orderBody.shape.items,
    totalPrice: orderBody.shape.expectedTotalPrice,
    deliveryAddress: orderBody.shape.deliveryAddress,
    deliverySlot: z.string().regex(/^09:00\s*-\s*12:00$/),
  })
  .refine(
    ({ items }) => new Set(items.map(({ id }) => id)).size === items.length,
  );

export const originalDepositBody = depositBody.extend({
  rate: z.literal(deposit.rate),
  termMonths: z.literal(deposit.termMonths),
});

export const confirmationKey = z.uuid();

export type OrderRequest = Omit<z.infer<typeof orderBody>, 'deliveryDate'> & {
  deliveryDate?: string;
};
