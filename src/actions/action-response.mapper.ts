import { NUXT_CONTRACT, RESPONSE_STATUS } from '../shared/api-contract.js';
import {
  HISTORY_TYPE,
  ORIGINAL_HISTORY_TYPE,
} from '../shared/history-types.js';
import type { HistoryResult } from './interfaces/index.js';

export type ActionResponse<T> =
  T | { newBalance: number; status: typeof RESPONSE_STATUS.ok };
type OriginalHistoryType =
  (typeof ORIGINAL_HISTORY_TYPE)[keyof typeof ORIGINAL_HISTORY_TYPE];
export type HistoryResponse =
  | HistoryResult
  | {
      balance: number;
      history: (Omit<HistoryResult['history'][number], 'type'> & {
        type: OriginalHistoryType;
      })[];
    };

export function mapActionResponse<T extends { newBalance: number }>(
  result: T,
  isOriginal: boolean,
): ActionResponse<T> {
  return isOriginal
    ? { status: RESPONSE_STATUS.ok, newBalance: result.newBalance }
    : result;
}

export function mapHistoryResponse(
  result: HistoryResult,
  contract?: string,
): HistoryResponse {
  if (contract === NUXT_CONTRACT) {
    return result;
  }
  return {
    balance: result.balance,
    history: result.history.map((entry) => ({
      ...entry,
      type:
        entry.type === HISTORY_TYPE.order
          ? ORIGINAL_HISTORY_TYPE.market
          : entry.type === HISTORY_TYPE.demo && entry.amount !== null
            ? ORIGINAL_HISTORY_TYPE.transfer
            : ORIGINAL_HISTORY_TYPE.analytics,
    })),
  };
}
