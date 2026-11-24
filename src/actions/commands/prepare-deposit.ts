import { deposit } from '../../shared/rules.js';
import type { Action, DepositResult } from '../interfaces/index.js';

export function prepareDeposit(amount: number): Action<DepositResult> {
  const { currency, rate, termMonths } = deposit;
  const estimatedInterest = Math.round((amount * rate * termMonths) / 1200);
  const offer = {
    amount,
    currency,
    estimatedInterest,
    estimatedTotal: amount + estimatedInterest,
    rate,
    termMonths,
  };

  return {
    amount,
    response: (depositId, newBalance) => ({ depositId, ...offer, newBalance }),
    snapshot: offer,
    subtitle: `На срок ${termMonths} мес.`,
    title: `Открытие вклада под ${rate}%`,
  };
}
