import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const destination = new URL('../public/scanner/', import.meta.url);
await mkdir(destination, { recursive: true });
await copyFile(
  require.resolve('zxing-wasm/reader/zxing_reader.wasm'),
  new URL('zxing_reader.wasm', destination),
);
console.log('Motor de códigos preparado en public/scanner (sin CDN externo).');
