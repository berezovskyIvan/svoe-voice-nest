import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { DemoDatabase } from '../../../persistence/demo-database.service.js';
import { buildDepositOffer } from '../../../shared/rules.js';
import { Analytics } from '../../analytics.service.js';
import { ASSISTANT_INTENT } from '../../assistant-intent-values.js';
import { classifyIntent } from '../../classify-intent.js';
import type { AssistantResult } from '../../interfaces/index.js';
import { YandexLanguageModel } from '../../yandex-language-model.service.js';
import { prepareOrderDraft } from '../prepare-order-draft.js';
import { ProcessTextCommand } from '../process-text.command.js';

const unknownCommandMessage =
  'Могу собрать заказ фермерских продуктов, показать траты за месяц или помочь открыть вклад.';

@CommandHandler(ProcessTextCommand)
export class ProcessTextHandler implements ICommandHandler<ProcessTextCommand> {
  constructor(
    private readonly analytics: Analytics,
    private readonly database: DemoDatabase,
    private readonly model: YandexLanguageModel,
  ) {}

  async execute({ text }: ProcessTextCommand): Promise<AssistantResult> {
    const now = new Date();
    const recognizedText = text.trim();
    const command = await classifyIntent(this.model, recognizedText, now);

    const { intent } = command;
    if (intent === ASSISTANT_INTENT.analytics) {
      return this.analytics.analyze(recognizedText, now);
    }

    if (intent === ASSISTANT_INTENT.unknown) {
      return { intent, message: unknownCommandMessage, recognizedText };
    }

    const store = await this.database.read();

    if (intent === ASSISTANT_INTENT.deposit) {
      const { balance } = await store.findAccount();
      return {
        intent,
        payload: {
          depositOffer: buildDepositOffer(balance),
          requestedAmount: command.amount,
        },
        recognizedText,
      };
    }

    return {
      intent,
      payload: await prepareOrderDraft(command, now, store),
      recognizedText,
    };
  }
}
