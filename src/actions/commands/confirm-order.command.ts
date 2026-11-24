import { Command } from '@nestjs/cqrs';
import type { OrderRequest } from '../action-requests.js';
import type { OrderResult } from '../interfaces/index.js';

export class ConfirmOrderCommand extends Command<OrderResult> {
  constructor(
    readonly input: OrderRequest,
    readonly key: string,
  ) {
    super();
  }
}
