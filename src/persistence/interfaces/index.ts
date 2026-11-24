import type { HistoryType } from '../../shared/history-types.js';

export interface HistoryEntry {
  amount: number | null;
  createdAt: Date;
  id: number;
  subtitle: string;
  title: string;
  type: HistoryType;
}
