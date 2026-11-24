import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { InitialDemoSchema1760000000000 } from './migrations/initial-demo-schema.js';
import { DemoRepository } from './demo-repository.js';
import { OriginalDemoFields1760000000001 } from './migrations/original-demo-fields.js';
import { seedDemoData } from './demo-seed.js';
import { ERROR_CODE, reject } from '../shared/errors.js';
import { DEMO_MODE } from './demo-mode.js';

export function databaseOptions(url?: string) {
  return {
    type: 'postgres' as const,
    url,
    migrations: [
      InitialDemoSchema1760000000000,
      OriginalDemoFields1760000000001,
    ],
    synchronize: false,
    connectTimeoutMS: 5_000,
  };
}

@Injectable()
export class DemoDatabase {
  private connection?: Promise<DataSource>;

  constructor(
    private readonly config: ConfigService,
    private readonly source: DataSource,
  ) {}

  async read(): Promise<DemoRepository> {
    return new DemoRepository((await this.connect()).manager);
  }

  async transaction<T>(
    work: (store: DemoRepository) => Promise<T>,
    isolation: 'READ COMMITTED' | 'REPEATABLE READ' = 'READ COMMITTED',
  ): Promise<T> {
    const connection = await this.connect();
    return connection.transaction(isolation, (manager) =>
      work(new DemoRepository(manager)),
    );
  }

  async resetHistory(): Promise<void> {
    const connection = await this.connect();
    await connection.transaction((manager) =>
      seedDemoData(manager, DEMO_MODE.resetHistory),
    );
  }

  private connect(): Promise<DataSource> {
    if (!this.connection) {
      const url = this.config.get<string>('DATABASE_URL');
      if (!url) {
        reject(503, ERROR_CODE.DATABASE_UNAVAILABLE, 'База данных недоступна');
      }
      this.connection = this.source.initialize().catch(() => {
        this.connection = undefined;
        reject(503, ERROR_CODE.DATABASE_UNAVAILABLE, 'База данных недоступна');
      });
    }
    return this.connection;
  }
}
