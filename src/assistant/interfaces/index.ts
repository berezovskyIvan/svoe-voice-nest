import type { buildCart } from '../../shared/catalog.js';
import type { DELIVERY_ISSUE } from '../../shared/delivery-options.js';
import type { buildDepositOffer, resolveDelivery } from '../../shared/rules.js';
import type { Analytics } from '../analytics.service.js';
import type { ASSISTANT_INTENT } from '../assistant-intent-values.js';

export interface SpendingCategory {
  amount: number;
  code: string;
  name: string;
  percent: number;
}

export type AssistantResult =
  | Awaited<ReturnType<Analytics['analyze']>>
  | {
      intent: typeof ASSISTANT_INTENT.deposit;
      payload: {
        depositOffer: ReturnType<typeof buildDepositOffer>;
        requestedAmount: number | null;
      };
      recognizedText: string;
    }
  | {
      intent: typeof ASSISTANT_INTENT.farmerProducts;
      payload: ReturnType<typeof buildCart> & {
        delivery: ReturnType<typeof resolveDelivery>;
        deliveryIssue: typeof DELIVERY_ISSUE.unsupported | null;
      };
      recognizedText: string;
    }
  | {
      intent: typeof ASSISTANT_INTENT.unknown;
      message: string;
      recognizedText: string;
    };
