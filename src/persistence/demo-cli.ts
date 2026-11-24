import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { databaseOptions } from './demo-database.service.js';
import { seedDemoData } from './demo-seed.js';
import { DEMO_MODE } from './demo-mode.js';

const command = process.argv[2];
const url = new ConfigService().get<string>('DATABASE_URL');
if (!url || (command !== DEMO_MODE.seed && command !== DEMO_MODE.reset)) {
  throw new Error('Set DATABASE_URL and select seed or reset');
}

const source = await new DataSource(databaseOptions(url)).initialize();
try {
  await source.runMigrations();
  await source.transaction((manager) => seedDemoData(manager, command));
  console.log(
    command === DEMO_MODE.seed ? 'Demo data ready' : 'Demo data reset',
  );
} finally {
  await source.destroy();
}
