import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { DemoDatabase } from '../../../persistence/demo-database.service.js';
import { ResetHistoryCommand } from '../reset-history.command.js';

@CommandHandler(ResetHistoryCommand)
export class ResetHistoryHandler implements ICommandHandler<ResetHistoryCommand> {
  constructor(private readonly database: DemoDatabase) {}

  execute(): Promise<void> {
    return this.database.resetHistory();
  }
}
