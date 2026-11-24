import { demoProducts } from '../../src/persistence/demo-products.js';
import { buildCart } from '../../src/shared/catalog.js';
import { PRODUCT_UNITS } from '../../src/shared/product-units.js';

it('selects the first matching product that fits the requested volume', () => {
  const milk = {
    name: 'молоко',
    quantity: 500,
    unit: PRODUCT_UNITS.milliliter,
    variant: '5,2%',
  } as const;
  const cart = buildCart(demoProducts, [milk]);

  expect(cart.items).toMatchObject([{ id: 5, qty: 1 }]);
  expect(cart.unmatchedItems).toEqual([]);
  expect(
    buildCart(demoProducts, [{ ...milk, quantity: 501 }]).unmatchedItems,
  ).toEqual(['молоко']);
});

it('does not match a percentage by the last digit of another percentage', () => {
  const cart = buildCart(demoProducts, [
    {
      name: 'молоко',
      quantity: 500,
      unit: PRODUCT_UNITS.milliliter,
      variant: '2%',
    },
  ]);

  expect(cart).toEqual({
    items: [],
    totalPrice: 0,
    unmatchedItems: ['молоко'],
  });
});

it('keeps the selected product when a repeated request exceeds its pack limit', () => {
  const milk = {
    name: 'молоко',
    quantity: 100,
    unit: PRODUCT_UNITS.pack,
    variant: null,
  };

  const cart = buildCart(demoProducts, [milk, { ...milk, quantity: 1 }]);

  expect(cart.items).toMatchObject([{ id: 1, qty: 100 }]);
  expect(cart.totalPrice).toBe(12_900);
  expect(cart.unmatchedItems).toEqual([milk.name]);
});
