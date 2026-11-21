import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { AssistantService } from '../../assistant.service.js';
import { ProcessTextCommand } from '../process-text.command.js';

@CommandHandler(ProcessTextCommand)
export class ProcessTextHandler implements ICommandHandler<ProcessTextCommand> {
  constructor(private readonly service: AssistantService) {}

  execute(
    command: ProcessTextCommand,
  ): ReturnType<AssistantService['process']> {
    return this.service.process(command.text);
  }
}
