import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { DemoDatabase } from '../../../persistence/demo-database.service.js';
import type { HistoryResult } from '../../interfaces/index.js';
import { GetHistoryQuery } from '../get-history.query.js';

@QueryHandler(GetHistoryQuery)
export class GetHistoryHandler implements IQueryHandler<GetHistoryQuery> {
  constructor(private readonly database: DemoDatabase) {}

  execute(): Promise<HistoryResult> {
    return this.database.transaction(async (store) => {
      const { balance, name } = await store.findAccount();
      return { balance, history: await store.findHistory(), user: { name } };
    }, 'REPEATABLE READ');
  }
}
