import type {
  Cart,
  LineItem,
  Product,
  RequestedProduct,
} from './interfaces/index.js';
import { PRODUCT_UNITS, type ProductUnit } from './product-units.js';

const demoProductIds = [1, 2, 3];
const maxPacksPerProduct = 100;
const baseUnits: Partial<Record<ProductUnit, ProductUnit>> = {
  [PRODUCT_UNITS.kilogram]: PRODUCT_UNITS.gram,
  [PRODUCT_UNITS.liter]: PRODUCT_UNITS.milliliter,
};

export function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/,/g, '.')
    .replace(/\s/g, '');
}

export function buildCart(
  products: Product[],
  requested: RequestedProduct[],
): Cart {
  const unmatchedItems: string[] = [];
  const selected = new Map<number, LineItem>();

  for (const item of requested) {
    const line = findLineItem(products, item, selected);
    if (line) {
      selected.set(line.id, line);
    } else {
      unmatchedItems.push(item.name);
    }
  }

  const items = requested.length
    ? [...selected.values()]
    : products
        .filter((product) => demoProductIds.includes(product.id))
        .map((product) => asLineItem(product, 1));
  return {
    items,
    totalPrice: totalPriceOf(items),
    unmatchedItems,
  };
}

function findLineItem(
  products: Product[],
  item: RequestedProduct,
  selected: ReadonlyMap<number, LineItem>,
): LineItem | undefined {
  const name = normalize(item.name);
  const variant = item.variant ? normalize(item.variant) : '';

  for (const product of products) {
    const productName = normalize(product.name);
    if (
      !matchesVariant(product.name, variant) ||
      (!productName.includes(name) &&
        !product.keywords.some((term) => normalize(term) === name))
    ) {
      continue;
    }

    const qty = countPacks(item, product);
    if (!Number.isSafeInteger(qty) || qty < 1) {
      continue;
    }

    const existing = selected.get(product.id);
    const mergedQty = qty + (existing?.qty ?? 0);
    if (mergedQty <= maxPacksPerProduct) {
      return asLineItem(product, mergedQty);
    }

    if (existing) {
      return undefined;
    }
  }
}

function matchesVariant(productName: string, variant: string): boolean {
  if (/^\d+(?:\.\d+)?%$/.test(variant)) {
    const percentages = productName.match(/\d+(?:[.,]\d+)?\s*%/g);
    return percentages?.some((value) => normalize(value) === variant) ?? false;
  }

  return normalize(productName).includes(variant);
}

function countPacks(
  { quantity, unit }: RequestedProduct,
  product: Product,
): number {
  const requestedQuantity = quantity ?? 1;

  if (quantity === null || !unit || unit === PRODUCT_UNITS.pack) {
    return requestedQuantity;
  }

  const baseUnit = baseUnits[unit] ?? unit;

  if (baseUnit !== product.packUnit) {
    return 0;
  }

  const baseQuantity =
    baseUnit === unit ? requestedQuantity : requestedQuantity * 1000;

  return baseQuantity / product.packSize;
}

export function totalPriceOf(items: { price: number; qty: number }[]): number {
  return items.reduce((sum, { price, qty }) => sum + price * qty, 0);
}

export function asLineItem(product: Product, qty: number): LineItem {
  const { id, imageUrl, name, price, unitLabel } = product;
  return { id, imageUrl, name, price, qty, unitLabel };
}
