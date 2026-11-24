import { Module } from '@nestjs/common';
import { PersistenceModule } from '../persistence/persistence.module.js';
import { ResetHistoryHandler } from './commands/handlers/reset-history.handler.js';
import { ActionsController } from './actions.controller.js';
import { ActionsService } from './actions.service.js';
import { ConfirmOrderHandler } from './commands/handlers/confirm-order.handler.js';
import { OpenDepositHandler } from './commands/handlers/open-deposit.handler.js';
import { GetHistoryHandler } from './queries/handlers/get-history.handler.js';
import { ConfirmAction } from './confirm-action.service.js';

@Module({
  controllers: [ActionsController],
  imports: [PersistenceModule],
  providers: [
    ActionsService,
    ConfirmAction,
    ConfirmOrderHandler,
    GetHistoryHandler,
    OpenDepositHandler,
    ResetHistoryHandler,
  ],
})
export class ActionsModule {}
