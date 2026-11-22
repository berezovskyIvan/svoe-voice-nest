import { Injectable, Logger } from '@nestjs/common';
import { DemoDatabase } from '../persistence/demo-database.service.js';
import { buildDepositOffer, deposit, monthBounds } from '../shared/rules.js';
import { YandexLanguageModel } from './yandex-language-model.service.js';

interface SpendingCategory {
  amount: number;
  code: string;
  name: string;
  percent: number;
}

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
    const offerAdvice = `Можно отложить часть свободных средств на вклад под ${deposit.rate}% годовых.`;
    const fallback = top
      ? `Больше всего за месяц ушло на категорию «${top.name}». ${offerAdvice}`
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
      type: 'analytics',
    });
    return {
      intent: 'analytics' as const,
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
        'Дай короткое нейтральное резюме трат и упомяни условия демо-вклада. Используй только переданные данные.',
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
