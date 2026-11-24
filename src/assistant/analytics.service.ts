import { Injectable, Logger } from '@nestjs/common';
import type { SpendingCategory } from './interfaces/index.js';
import { DemoDatabase } from '../persistence/demo-database.service.js';
import { buildDepositOffer, deposit, monthBounds } from '../shared/rules.js';
import { YandexLanguageModel } from './yandex-language-model.service.js';
import { ASSISTANT_INTENT } from './assistant-intent-values.js';
import { HISTORY_TYPE } from '../shared/history-types.js';

const categoryNames: Record<string, string> = {
  cafes: 'Кафе и рестораны',
  groceries: 'Супермаркеты',
  transport: 'Транспорт',
  marketplaces: 'Маркетплейсы',
  other: 'Прочее',
  pharmacies: 'Аптеки',
};

@Injectable()
export class Analytics {
  private readonly logger = new Logger(Analytics.name);

  constructor(
    private readonly database: DemoDatabase,
    private readonly model: YandexLanguageModel,
  ) {}

  async analyze(recognizedText: string, now: Date) {
    const { period, start, end } = monthBounds(now);
    const store = await this.database.read();
    const rows = await store.findSpending(start, end);
    const totalSpent = rows.reduce((sum, row) => sum + row.amount, 0);
    const categories = rows.map(({ code, amount }) => ({
      amount,
      code,
      name: categoryNames[code] ?? code,
      percent: Math.round((amount / totalSpent) * 100),
    }));
    const top = categories[0];
    const offerAdvice = `Если часть денег пока не нужна, положи её на вклад на ${deposit.termMonths} месяцев под ${deposit.rate}% годовых. Посмотри ниже, сколько принесут проценты. Так к концу срока у тебя будет больше денег на крупную покупку!`;
    const fallback = top
      ? `Кстати, я посмотрел твои траты за этот месяц. ${offerAdvice}`
      : `За текущий месяц трат пока нет. ${offerAdvice}`;
    const aiAdvice = await this.askForAdvice({
      categories,
      fallback,
      period,
      totalSpent,
    });
    const { balance } = await store.findAccount();
    await store.insertHistory({
      subtitle: top
        ? `${top.name} · ${top.percent}%`
        : 'Трат за месяц пока нет',
      title: recognizedText,
      type: HISTORY_TYPE.analytics,
    });
    return {
      intent: ASSISTANT_INTENT.analytics,
      recognizedText,
      payload: {
        period,
        totalSpent,
        categories,
        aiAdvice,
        depositOffer: buildDepositOffer(balance),
      },
    };
  }

  private async askForAdvice(input: {
    categories: SpendingCategory[];
    fallback: string;
    period: string;
    totalSpent: number;
  }): Promise<string> {
    const { categories, fallback, period, totalSpent } = input;
    try {
      return await this.model.complete(
        `Напиши короткую рекламную подводку к карточке вклада после диаграммы расходов. Обращайся на «ты» и пиши короткими разговорными фразами.
Первое предложение возьми дословно из примера. Не оценивай, много или мало потратил пользователь, и не повторяй цифры и категории с диаграммы.
Предложи положить на вклад деньги, которые пока не нужны, и назови переданные срок и годовую ставку. Пригласи посмотреть пример дохода в карточке ниже. В последнем предложении уверенно скажи, что проценты по вкладу помогут накопить больше на крупную покупку. Напиши четыре коротких предложения без вопросов.
Не утверждай, что знаешь баланс, планы пользователя или сумму, которую он может отложить. Не обещай быстрый рост денег, достижение цели или дату покупки. Не сравнивай вклад с другими предложениями.
Пример реплики. После первого предложения можешь перефразировать текст: ${fallback}`,
        JSON.stringify({
          categories,
          period,
          rate: deposit.rate,
          termMonths: deposit.termMonths,
          totalSpent,
        }),
      );
    } catch {
      this.logger.warn('Unable to generate analytics commentary');
      return fallback;
    }
  }
}
