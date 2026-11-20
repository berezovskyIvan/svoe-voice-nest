import catalog from './demo-catalog.json' with { type: 'json' };

export const demoProducts = catalog.map(
  ({
    category,
    id,
    imageUrl,
    keywords,
    name,
    packSize,
    packUnit,
    price,
    unitLabel,
  }) => ({
    category,
    id,
    imageUrl,
    keywords,
    name,
    packSize,
    packUnit,
    price,
    unitLabel,
  }),
);
