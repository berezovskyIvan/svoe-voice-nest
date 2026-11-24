import type { HistoryEntry } from '../../persistence/interfaces/index.js';

export interface DepositResult {
  amount: number;
  currency: string;
  depositId: number;
  estimatedInterest: number;
  estimatedTotal: number;
  newBalance: number;
  rate: number;
  termMonths: number;
}

export interface OrderResult {
  newBalance: number;
  orderId: number;
  totalPrice: number;
}

export interface HistoryResult {
  balance: number;
  history: HistoryEntry[];
  user: { name: string };
}

export interface Action<T> {
  amount: number;
  response: (historyId: number, newBalance: number) => T;
  snapshot: object;
  subtitle: string;
  title: string;
}
