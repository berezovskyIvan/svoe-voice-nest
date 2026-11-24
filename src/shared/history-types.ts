export const HISTORY_TYPE = {
  analytics: 'analytics',
  demo: 'demo',
  deposit: 'deposit',
  order: 'order',
} as const;

export const ORIGINAL_HISTORY_TYPE = {
  analytics: HISTORY_TYPE.analytics,
  market: 'market',
  transfer: 'transfer',
} as const;

export type HistoryType = (typeof HISTORY_TYPE)[keyof typeof HISTORY_TYPE];
export type ConfirmationType =
  typeof HISTORY_TYPE.deposit | typeof HISTORY_TYPE.order;
