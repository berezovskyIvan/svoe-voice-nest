import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ActionsService } from '../../actions.service.js';
import { OpenDepositCommand } from '../open-deposit.command.js';

@CommandHandler(OpenDepositCommand)
export class OpenDepositHandler implements ICommandHandler<OpenDepositCommand> {
  constructor(private readonly service: ActionsService) {}

  execute(
    command: OpenDepositCommand,
  ): ReturnType<ActionsService['openDeposit']> {
    return this.service.openDeposit(command.amount, command.key);
  }
}
