import type { ProductUnit } from '../product-units.js';

export interface Cart {
  items: LineItem[];
  totalPrice: number;
  unmatchedItems: string[];
}

export interface LineItem {
  id: number;
  imageUrl: string;
  name: string;
  price: number;
  qty: number;
  unitLabel: string;
}

export interface Product extends Omit<LineItem, 'qty'> {
  keywords: string[];
  packSize: number;
  packUnit: string;
}

export interface RequestedProduct {
  name: string;
  quantity: number | null;
  unit: ProductUnit | null;
  variant: string | null;
}
