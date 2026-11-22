import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { Analytics } from './analytics.service.js';
import { parseIntent, type AssistantIntent } from './assistant-intent.js';
import { buildCart } from '../shared/catalog.js';
import { DemoDatabase } from '../persistence/demo-database.service.js';
import { reject } from '../shared/errors.js';
import {
  buildDepositOffer,
  moscowDate,
  resolveDelivery,
} from '../shared/rules.js';
import { YandexLanguageModel } from './yandex-language-model.service.js';

export type AssistantResult =
  | Awaited<ReturnType<Analytics['analyze']>>
  | {
      intent: 'deposit';
      payload: {
        depositOffer: ReturnType<typeof buildDepositOffer>;
        requestedAmount: number | null;
      };
      recognizedText: string;
    }
  | {
      intent: 'farmer-products';
      payload: ReturnType<typeof buildCart> & {
        delivery: ReturnType<typeof resolveDelivery>;
        deliveryIssue: 'UNSUPPORTED_DELIVERY' | null;
      };
      recognizedText: string;
    }
  | { intent: 'unknown'; message: string; recognizedText: string };

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(
    private readonly analytics: Analytics,
    private readonly database: DemoDatabase,
    private readonly model: YandexLanguageModel,
  ) {}

  async process(text: string): Promise<AssistantResult> {
    const now = new Date();
    const recognizedText = text.trim();
    const command = await this.classify(recognizedText, now);
    if (command.intent === 'analytics')
      return this.analytics.analyze(recognizedText, now);
    if (command.intent === 'unknown') {
      return {
        intent: command.intent,
        message:
          'Могу собрать заказ фермерских продуктов, показать траты за месяц или помочь открыть вклад.',
        recognizedText,
      };
    }
    const store = await this.database.read();
    if (command.intent === 'deposit') {
      const { balance } = await store.findAccount();
      return {
        intent: command.intent,
        payload: {
          depositOffer: buildDepositOffer(balance),
          requestedAmount: command.amount,
        },
        recognizedText,
      };
    }
    const products = await store.findProducts(
      undefined,
      command.items.map(({ name }) => name),
    );
    const cart = buildCart(products, command.items);
    const delivery = resolveDelivery(
      command.deliveryDay,
      command.deliveryTime,
      now,
    );
    return {
      intent: command.intent,
      payload: {
        ...cart,
        delivery,
        deliveryIssue: delivery ? null : 'UNSUPPORTED_DELIVERY',
      },
      recognizedText,
    };
  }

  private async classify(
    recognizedText: string,
    now: Date,
  ): Promise<AssistantIntent> {
    try {
      const answer = await this.model.complete(
        `Классифицируй банковскую команду. Отвечай только JSON. Сегодня ${moscowDate(now)} в Москве.
Вопрос о тратах за текущий месяц или без периода: {"intent":"analytics"}.
Просьба открыть банковский вклад: «Хочу открыть вклад» → {"intent":"deposit","amount":null}, «Открой вклад на двести тысяч рублей» → {"intent":"deposit","amount":200000}. Сумму укажи числом в рублях, включая суммы прописью, или null, если точная сумма в рублях не указана. Не принимай срок или ставку за сумму. Вопрос об условиях существующего вклада, его пополнение или закрытие: {"intent":"unknown"}.
Заказ фермерских продуктов: {"intent":"farmer-products","items":[{"name":"молоко","variant":"3,2%","quantity":null,"unit":null}],"deliveryDay":"saturday","deliveryTime":"morning"}.
Для товара укажи базовое название в именительном падеже, характеристику (например жирность) отдельно. Запиши устное «3 и 2 процента» как «3,2%».
Количество укажи числом, единица pack, piece, g, kg, ml или l. Десяток яиц — 10 piece.
Отсутствующие поля товара равны null. При отсутствии названий items = [].
День доставки: today, tomorrow, английское название дня недели, YYYY-MM-DD, unsupported или null.
Время доставки: morning (утро или слот 09–12), unsupported (другое время) или null.
Любая другая команда, включая ЖКХ и аналитику за другой месяц: {"intent":"unknown"}.`,
        recognizedText,
        true,
      );
      return parseIntent.parse(JSON.parse(answer));
    } catch (error) {
      const reason =
        error instanceof z.ZodError
          ? error.issues
              .map((issue) => issue.path.join('.') || issue.code)
              .join(', ')
          : error instanceof Error
            ? error.name
            : 'unknown';
      this.logger.warn(`Unable to classify command (${reason})`);
      return reject(
        503,
        'ASSISTANT_UNAVAILABLE',
        'Помощник временно недоступен',
      );
    }
  }
}
