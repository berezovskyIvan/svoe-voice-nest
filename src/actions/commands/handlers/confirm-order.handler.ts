import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { HISTORY_TYPE } from '../../../shared/history-types.js';
import { ConfirmAction } from '../../confirm-action.service.js';
import type { OrderResult } from '../../interfaces/index.js';
import { ConfirmOrderCommand } from '../confirm-order.command.js';
import { prepareOrder } from '../prepare-order.js';

@CommandHandler(ConfirmOrderCommand)
export class ConfirmOrderHandler implements ICommandHandler<ConfirmOrderCommand> {
  constructor(private readonly confirmation: ConfirmAction) {}

  execute({ input, key }: ConfirmOrderCommand): Promise<OrderResult> {
    const request = {
      ...input,
      items: [...input.items].sort((left, right) => left.id - right.id),
    };
    return this.confirmation.execute({
      key,
      prepare: (store) => prepareOrder(input, store),
      request,
      type: HISTORY_TYPE.order,
    });
  }
}
