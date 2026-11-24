export const PRODUCT_UNITS = {
  gram: 'g',
  kilogram: 'kg',
  liter: 'l',
  milliliter: 'ml',
  pack: 'pack',
  piece: 'piece',
} as const;

export type ProductUnit = (typeof PRODUCT_UNITS)[keyof typeof PRODUCT_UNITS];
