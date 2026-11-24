import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { HISTORY_TYPE } from '../../../shared/history-types.js';
import { ConfirmAction } from '../../confirm-action.service.js';
import type { DepositResult } from '../../interfaces/index.js';
import { OpenDepositCommand } from '../open-deposit.command.js';
import { prepareDeposit } from '../prepare-deposit.js';

@CommandHandler(OpenDepositCommand)
export class OpenDepositHandler implements ICommandHandler<OpenDepositCommand> {
  constructor(private readonly confirmation: ConfirmAction) {}

  execute({ amount, key }: OpenDepositCommand): Promise<DepositResult> {
    return this.confirmation.execute({
      key,
      prepare: () => prepareDeposit(amount),
      request: { amount },
      type: HISTORY_TYPE.deposit,
    });
  }
}
