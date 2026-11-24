import { Command } from '@nestjs/cqrs';
import type { AssistantResult } from '../interfaces/index.js';

export class ProcessTextCommand extends Command<AssistantResult> {
  constructor(readonly text: string) {
    super();
  }
}
