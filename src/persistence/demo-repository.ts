import type { EntityManager } from 'typeorm';
import { normalize, type Product } from '../shared/catalog.js';
import { reject } from '../shared/errors.js';
import { DEMO_ACCOUNT_ID } from '../shared/rules.js';

export interface HistoryEntry {
  amount: number | null;
  createdAt: Date;
  id: number;
  subtitle: string;
  title: string;
  type: 'order' | 'analytics' | 'deposit' | 'demo';
}

export class DemoRepository {
  constructor(private readonly manager: EntityManager) {}

  async findAccount(lock = false): Promise<{ balance: number; name: string }> {
    const query = this.manager
      .createQueryBuilder()
      .select('balance')
      .addSelect('account."userName"', 'name')
      .from('accounts', 'account')
      .where('id = :id', { id: DEMO_ACCOUNT_ID });
    if (lock) query.setLock('pessimistic_write');
    const account = await query.getRawOne<{ balance: number; name: string }>();
    if (!account)
      return reject(503, 'DATABASE_UNAVAILABLE', 'Демо-счёт недоступен');
    return account;
  }

  findConfirmation<T>(input: {
    key: string;
    request: object;
    type: 'order' | 'deposit';
  }): Promise<{ matches: boolean; response: T } | undefined> {
    return this.manager
      .createQueryBuilder()
      .select('request = CAST(:request AS jsonb)', 'matches')
      .addSelect('response')
      .from('assistant_history', 'history')
      .where('type = :type AND confirmation_key = :key', input)
      .setParameter('request', JSON.stringify(input.request))
      .getRawOne<{ matches: boolean; response: T }>();
  }

  findHistory(): Promise<HistoryEntry[]> {
    return this.manager
      .createQueryBuilder()
      .select(['amount', '"createdAt"', 'id', 'subtitle', 'title', 'type'])
      .from('assistant_history', 'history')
      .orderBy('"createdAt"', 'DESC')
      .addOrderBy('id', 'DESC')
      .getRawMany<HistoryEntry>();
  }

  findProducts(ids?: number[], keywords: string[] = []): Promise<Product[]> {
    const query = this.manager
      .createQueryBuilder()
      .select([
        'id',
        '"imageUrl"',
        'keywords',
        'name',
        '"packSize"',
        '"packUnit"',
        'price',
        '"unitLabel"',
      ])
      .from('products', 'product')
      .orderBy('id');
    if (ids)
      query.where('id IN (:...ids)', { ids }).setLock('pessimistic_read');
    if (keywords.length) {
      const terms = keywords.map(normalize);
      const patterns = terms.map(
        (term) => '%' + term.replace(/[\\%_]/g, '\\$&') + '%',
      );
      query.andWhere(
        `regexp_replace(translate(lower(product.name), 'ё,', 'е.'), '[[:space:]]', '', 'g') ILIKE ANY(:patterns)
        OR EXISTS (
          SELECT 1 FROM unnest(product.keywords) AS keyword
          WHERE regexp_replace(translate(lower(keyword), 'ё,', 'е.'), '[[:space:]]', '', 'g') = ANY(:terms)
        )`,
        { patterns, terms },
      );
    }
    return query.getRawMany<Product>();
  }

  findSpending(
    start: Date,
    end: Date,
  ): Promise<{ amount: number; code: string }[]> {
    return this.manager
      .createQueryBuilder()
      .select('category', 'code')
      .addSelect('CAST(SUM(amount) AS double precision)', 'amount')
      .from('transactions', 'transactions')
      .where('date >= :start AND date < :end', { end, start })
      .groupBy('category')
      .orderBy('SUM(amount)', 'DESC')
      .addOrderBy('category')
      .getRawMany<{ amount: number; code: string }>();
  }

  async insertHistory(entry: {
    amount?: number;
    confirmation_key?: string;
    request?: string;
    snapshot?: string;
    subtitle: string;
    title: string;
    type: HistoryEntry['type'];
  }): Promise<number> {
    const { raw } = await this.manager
      .createQueryBuilder()
      .insert()
      .into('assistant_history')
      .values(entry)
      .returning('id')
      .execute();
    const [row] = raw as { id: number }[];
    return row.id;
  }

  async updateBalance(balance: number): Promise<void> {
    await this.manager
      .createQueryBuilder()
      .update('accounts')
      .set({ balance })
      .where('id = :id', { id: DEMO_ACCOUNT_ID })
      .execute();
  }

  async updateConfirmation(id: number, response: object): Promise<void> {
    await this.manager
      .createQueryBuilder()
      .update('assistant_history')
      .set({ response: JSON.stringify(response) })
      .where('id = :id', { id })
      .execute();
  }
}
