export const DELIVERY_DAY = {
  today: 'today',
  tomorrow: 'tomorrow',
  unsupported: 'unsupported',
} as const;

export const DELIVERY_TIME = {
  morning: 'morning',
  unsupported: DELIVERY_DAY.unsupported,
} as const;

export const DELIVERY_ISSUE = {
  unsupported: 'UNSUPPORTED_DELIVERY',
} as const;

export const weekdays: readonly string[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export type DeliveryTime = (typeof DELIVERY_TIME)[keyof typeof DELIVERY_TIME];
