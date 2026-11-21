import { Query } from '@nestjs/cqrs';
import type { HistoryResult } from '../actions.service.js';

export class GetHistoryQuery extends Query<HistoryResult> {}
