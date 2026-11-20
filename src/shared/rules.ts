import { tz } from '@date-fns/tz';
import {
  addDays,
  addMonths,
  format,
  getDay,
  getHours,
  isValid,
  parseISO,
  startOfMonth,
} from 'date-fns';

export const DELIVERY_ADDRESS = 'ул. Красная, 122';
export const DELIVERY_SLOT = '09:00-12:00';
export const DEMO_ACCOUNT_ID = 1;
export const STARTING_BALANCE = 1_800_000;

export const deposit = {
  currency: 'RUB',
  maxAmount: 10_000_000,
  minAmount: 500,
  rate: 14,
  termMonths: 6,
} as const;

const moscow = { in: tz('Europe/Moscow') };
const weekdays = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export function deliveryAvailable(
  date: string,
  slot: string,
  now: Date,
): boolean {
  const today = moscowDate(now);
  return (
    isDate(date) &&
    slot === DELIVERY_SLOT &&
    (date > today || (date === today && getHours(now, moscow) < 9))
  );
}

export function isDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && isValid(parseISO(date, moscow));
}

export function monthBounds(now: Date): {
  end: Date;
  period: string;
  start: Date;
} {
  const start = startOfMonth(now, moscow);
  return {
    end: new Date(addMonths(start, 1, moscow).getTime()),
    period: format(start, 'yyyy-MM', moscow),
    start: new Date(start.getTime()),
  };
}

export function moscowDate(now: Date): string {
  return format(now, 'yyyy-MM-dd', moscow);
}

export function resolveDelivery(
  day: string | null,
  time: 'morning' | 'unsupported' | null,
  now: Date,
): { address: string; date: string; slot: string } | null {
  if (time === 'unsupported') return null;
  const date = resolveDeliveryDate(day, now);
  return deliveryAvailable(date, DELIVERY_SLOT, now)
    ? { address: DELIVERY_ADDRESS, date, slot: DELIVERY_SLOT }
    : null;
}

function resolveDeliveryDate(day: string | null, now: Date): string {
  const today = moscowDate(now);
  const canDeliverToday = deliveryAvailable(today, DELIVERY_SLOT, now);
  if (day === 'today') return today;
  if (day === 'tomorrow' || (day === null && !canDeliverToday)) {
    return moscowDate(addDays(now, 1, moscow));
  }
  if (day === null) return today;
  const weekday = weekdays.indexOf(day);
  if (weekday < 0) return day;
  const delta = (weekday - getDay(now, moscow) + 7) % 7;
  return moscowDate(
    addDays(now, delta === 0 && !canDeliverToday ? 7 : delta, moscow),
  );
}
