import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ActionsService } from '../../actions.service.js';
import { ConfirmOrderCommand } from '../confirm-order.command.js';

@CommandHandler(ConfirmOrderCommand)
export class ConfirmOrderHandler implements ICommandHandler<ConfirmOrderCommand> {
  constructor(private readonly service: ActionsService) {}

  execute(command: ConfirmOrderCommand): ReturnType<ActionsService['order']> {
    return this.service.order(command.input, command.key);
  }
}
