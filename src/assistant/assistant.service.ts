import { Injectable } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ProcessTextCommand } from './commands/process-text.command.js';
import type { AssistantResult } from './interfaces/index.js';

@Injectable()
export class AssistantService {
  constructor(private readonly commandBus: CommandBus) {}

  process(text: string): Promise<AssistantResult> {
    return this.commandBus.execute(new ProcessTextCommand(text));
  }
}
