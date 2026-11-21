import { mkdir, readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const catalogUrl = new URL(
  '../src/persistence/demo-catalog.json',
  import.meta.url,
);
const outputDirectory = new URL('../public/products/', import.meta.url);
const products = JSON.parse(await readFile(catalogUrl, 'utf8'));
const failures = [];
await mkdir(outputDirectory, { recursive: true });

for (let offset = 0; offset < products.length; offset += 4) {
  const results = await Promise.allSettled(
    products.slice(offset, offset + 4).map(saveImage),
  );
  for (const result of results) {
    if (result.status === 'rejected') failures.push(result.reason.message);
  }
}
if (failures.length) throw new Error(failures.join('\n'));
console.log(`${products.length} WebP images prepared`);

async function saveImage({ id, imageSource }) {
  const source = new URL(imageSource);
  if (
    source.origin !== 'https://api.svoe-rodnoe.ru' ||
    !Number.isSafeInteger(id) ||
    id < 1
  ) {
    throw new Error('Invalid catalog image');
  }
  const output = fileURLToPath(new URL(`${id}.webp`, outputDirectory));
  const metadata = await sharp(output)
    .metadata()
    .catch(() => null);
  if (
    metadata?.format === 'webp' &&
    metadata.width === 400 &&
    metadata.height === 400
  )
    return;
  const buffer = await fetchImage(source, id);
  await sharp(buffer)
    .rotate()
    .resize(400, 400, { fit: 'cover' })
    .webp({ quality: 80 })
    .toFile(output);
}

async function fetchImage(source, id) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(source, {
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
    }).catch(() => undefined);
    if (response?.ok) return Buffer.from(await response.arrayBuffer());
    await response?.body?.cancel();
    if (response && response.status < 500 && response.status !== 429) {
      throw new Error(`Image ${id}: HTTP ${response.status}`);
    }
    await delay(500 * (attempt + 1));
  }
  throw new Error(`Image ${id}: retries exhausted`);
}
