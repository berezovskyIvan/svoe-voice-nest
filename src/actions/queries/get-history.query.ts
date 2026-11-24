import { Query } from '@nestjs/cqrs';
import type { HistoryResult } from '../interfaces/index.js';

export class GetHistoryQuery extends Query<HistoryResult> {}
