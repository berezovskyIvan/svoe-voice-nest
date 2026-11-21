import { Command } from '@nestjs/cqrs';
import type { DepositResult } from '../actions.service.js';

export class OpenDepositCommand extends Command<DepositResult> {
  constructor(
    readonly amount: number,
    readonly key: string,
  ) {
    super();
  }
}
