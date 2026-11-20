import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialDemoSchema1760000000000 implements MigrationInterface {
  async up(runner: QueryRunner) {
    await runner.query(`
      CREATE TABLE accounts (
        id integer PRIMARY KEY,
        name text NOT NULL,
        balance integer NOT NULL CHECK (balance >= 0)
      );
      CREATE TABLE products (
        id integer PRIMARY KEY,
        name text NOT NULL,
        category text NOT NULL,
        "unitLabel" text NOT NULL,
        "packSize" integer NOT NULL CHECK ("packSize" > 0),
        "packUnit" text NOT NULL,
        price integer NOT NULL CHECK (price > 0),
        "imageUrl" text NOT NULL,
        keywords text[] NOT NULL DEFAULT '{}'
      );
      CREATE TABLE transactions (
        id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        category text NOT NULL,
        amount integer NOT NULL CHECK (amount > 0),
        date timestamptz NOT NULL
      );
      CREATE INDEX transactions_date_idx ON transactions (date);
      CREATE TABLE assistant_history (
        id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        type text NOT NULL CHECK (type IN ('order', 'analytics', 'deposit', 'demo')),
        title text NOT NULL,
        subtitle text NOT NULL,
        amount integer,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        confirmation_key uuid,
        request jsonb,
        snapshot jsonb,
        response jsonb,
        UNIQUE (type, confirmation_key)
      );
      CREATE INDEX assistant_history_created_idx ON assistant_history ("createdAt" DESC, id DESC);
    `);
  }

  async down(runner: QueryRunner) {
    await runner.query(
      'DROP TABLE assistant_history, transactions, products, accounts',
    );
  }
}
