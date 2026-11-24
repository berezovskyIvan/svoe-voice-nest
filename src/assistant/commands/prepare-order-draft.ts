import type { DemoRepository } from '../../persistence/demo-repository.js';
import { buildCart } from '../../shared/catalog.js';
import { DELIVERY_ISSUE } from '../../shared/delivery-options.js';
import { resolveDelivery } from '../../shared/rules.js';
import type { ASSISTANT_INTENT } from '../assistant-intent-values.js';
import type { AssistantIntent } from '../assistant-intent.js';
import type { AssistantResult } from '../interfaces/index.js';

type OrderIntent = Extract<
  AssistantIntent,
  { intent: typeof ASSISTANT_INTENT.farmerProducts }
>;
type OrderDraft = Extract<
  AssistantResult,
  { intent: OrderIntent['intent'] }
>['payload'];

export async function prepareOrderDraft(
  command: OrderIntent,
  now: Date,
  store: DemoRepository,
): Promise<OrderDraft> {
  const products = await store.findProducts(
    undefined,
    command.items.map(({ name }) => name),
  );

  const delivery = resolveDelivery(
    command.deliveryDay,
    command.deliveryTime,
    now,
    command.deliveryAddress ?? undefined,
  );

  return {
    ...buildCart(products, command.items),
    delivery,
    deliveryIssue: delivery ? null : DELIVERY_ISSUE.unsupported,
  };
}
