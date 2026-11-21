import { QueryHandler, type IQueryHandler } from '@nestjs/cqrs';
import { ActionsService } from '../../actions.service.js';
import { GetHistoryQuery } from '../get-history.query.js';

@QueryHandler(GetHistoryQuery)
export class GetHistoryHandler implements IQueryHandler<GetHistoryQuery> {
  constructor(private readonly service: ActionsService) {}

  execute(_query: GetHistoryQuery): ReturnType<ActionsService['history']> {
    return this.service.history();
  }
}
