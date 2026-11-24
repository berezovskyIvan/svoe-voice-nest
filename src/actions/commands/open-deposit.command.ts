import { Command } from '@nestjs/cqrs';
import type { DepositResult } from '../interfaces/index.js';

export class OpenDepositCommand extends Command<DepositResult> {
  constructor(
    readonly amount: number,
    readonly key: string,
  ) {
    super();
  }
}
