import type { MigrationInterface, QueryRunner } from 'typeorm';

export class OriginalDemoFields1760000000001 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`
      ALTER TABLE accounts RENAME COLUMN name TO "userName";
      ALTER TABLE accounts ADD COLUMN title text NOT NULL DEFAULT 'Текущий счет';
      ALTER TABLE products ADD COLUMN unit text GENERATED ALWAYS AS (
        CASE "packUnit" WHEN 'g' THEN 'кг' WHEN 'piece' THEN 'шт' ELSE 'уп' END
      ) STORED;
    `);
  }

  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`
      ALTER TABLE products DROP COLUMN unit;
      ALTER TABLE accounts DROP COLUMN title;
      ALTER TABLE accounts RENAME COLUMN "userName" TO name;
    `);
  }
}
