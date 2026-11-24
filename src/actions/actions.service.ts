import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import type { OrderRequest } from './action-requests.js';
import { ConfirmOrderCommand } from './commands/confirm-order.command.js';
import { OpenDepositCommand } from './commands/open-deposit.command.js';
import { ResetHistoryCommand } from './commands/reset-history.command.js';
import type {
  DepositResult,
  HistoryResult,
  OrderResult,
} from './interfaces/index.js';
import { GetHistoryQuery } from './queries/get-history.query.js';

@Injectable()
export class ActionsService {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  history(): Promise<HistoryResult> {
    return this.queryBus.execute(new GetHistoryQuery());
  }

  openDeposit(amount: number, key: string): Promise<DepositResult> {
    return this.commandBus.execute(new OpenDepositCommand(amount, key));
  }

  order(input: OrderRequest, key: string): Promise<OrderResult> {
    return this.commandBus.execute(new ConfirmOrderCommand(input, key));
  }

  reset(): Promise<void> {
    return this.commandBus.execute(new ResetHistoryCommand());
  }
}
