const demoProductIds = [1, 2, 3];

export interface Product {
  id: number;
  imageUrl: string;
  keywords: string[];
  name: string;
  packSize: number;
  packUnit: string;
  price: number;
  unitLabel: string;
}

export interface RequestedProduct {
  name: string;
  variant: string | null;
  quantity: number | null;
  unit: 'pack' | 'piece' | 'g' | 'kg' | 'ml' | 'l' | null;
}

export function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/,/g, '.')
    .replace(/\s/g, '');
}

export function buildCart(products: Product[], requested: RequestedProduct[]) {
  const unmatchedItems: string[] = [];
  const selected = new Map<number, ReturnType<typeof asLineItem>>();

  for (const item of requested) {
    const name = normalize(item.name);
    const variant = item.variant ? normalize(item.variant) : '';
    const match = products.find((product) => {
      const productName = normalize(product.name);
      return (
        (productName === name ||
          product.keywords.some((term) => normalize(term) === name) ||
          productName.includes(name)) &&
        productName.includes(variant)
      );
    });
    const baseUnit =
      item.unit === 'l' ? 'ml' : item.unit === 'kg' ? 'g' : item.unit;
    const quantity = item.quantity ?? 1;
    const scaledQuantity =
      item.unit === 'l' || item.unit === 'kg' ? quantity * 1000 : quantity;
    const qty =
      match && item.quantity !== null && baseUnit && baseUnit !== 'pack'
        ? baseUnit === match.packUnit
          ? scaledQuantity / match.packSize
          : 0
        : quantity;
    const merged = qty + (match ? (selected.get(match.id)?.qty ?? 0) : 0);
    if (!match || !Number.isSafeInteger(qty) || qty < 1 || merged > 100) {
      unmatchedItems.push(item.name);
      continue;
    }
    selected.set(match.id, asLineItem(match, merged));
  }

  const items = requested.length
    ? [...selected.values()]
    : products
        .filter((product) => demoProductIds.includes(product.id))
        .map((product) => asLineItem(product, 1));
  return {
    items,
    unmatchedItems,
    totalPrice: items.reduce((sum, item) => sum + item.price * item.qty, 0),
  };
}

export function asLineItem(product: Product, qty: number) {
  const { id, imageUrl, name, price, unitLabel } = product;
  return { id, imageUrl, name, price, qty, unitLabel };
}
