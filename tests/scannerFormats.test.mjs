import assert from 'node:assert/strict';
import test from 'node:test';
import bwip from 'bwip-js';
import JsBarcode from 'jsbarcode';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { readBarcodes, prepareZXingModule } from 'zxing-wasm/reader';
import { cameraBarcodeText, barcodeVariants } from '../src/lib/barcodes.ts';
import { createCameraReaderOptions } from '../src/lib/scannerFormats.ts';

const require = createRequire(import.meta.url);
await prepareZXingModule({
  overrides: { wasmBinary: readFileSync(require.resolve('zxing-wasm/reader/zxing_reader.wasm')) },
  fireImmediately: true,
});

async function decode(pixels, width, height) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < pixels.length; i++) {
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = pixels[i];
    data[i * 4 + 3] = 255;
  }
  const results = await readBarcodes({ data, width, height }, createCameraReaderOptions());
  assert.equal(results.length, 1, 'Debe detectar exactamente un código');
  assert.equal(results[0].isValid, true);
  return results[0];
}

test('habilita todos los formatos legibles sin aceptar errores ni cambiar texto', () => {
  const options = createCameraReaderOptions();
  assert.deepEqual(options.formats, ['AllReadable']);
  assert.equal(options.returnErrors, false);
  assert.equal(options.textMode, 'Plain');
  options.formats.pop();
  assert.deepEqual(createCameraReaderOptions().formats, ['AllReadable']);
});

for (const [format, code, expected = code] of [
  ['EAN13', '5901234123457'],
  ['EAN8', '96385074'],
  ['UPC', '012345678905'],
  ['UPCE', '04252614'],
  ['CODE128', 'abc-123 / LOT+01'],
  ['CODE39', 'ABC-123'],
  ['CODE93', 'ABC-123'],
  ['ITF', '99123456789012'],
  ['codabar', 'A123456B'],
]) {
  test(`decodifica una imagen ${format} generada con JsBarcode`, async () => {
    const image = {};
    JsBarcode(image, code, { format, displayValue: false });
    const bits = image.encodings.map(encoding => encoding.data).join('');
    const width = bits.length * 3 + 80;
    const height = 140;
    const pixels = new Uint8ClampedArray(width * height).fill(255);
    for (let y = 20; y < height - 20; y++) {
      for (let x = 0; x < bits.length; x++) {
        if (bits[x] === '1') pixels.fill(0, y * width + 40 + x * 3, y * width + 43 + x * 3);
      }
    }
    const result = await decode(pixels, width, height);
    assert.ok(barcodeVariants(expected).includes(cameraBarcodeText(result)), `${format}: ${result.text}`);
  });
}

for (const [name, bcid, code] of [
  ['QRCode', 'qrcode', 'LOT-A 001/23'],
  ['MicroQRCode', 'microqrcode', 'ABC123'],
  ['DataMatrix', 'datamatrix', 'LOT-A 001/23'],
  ['Aztec', 'azteccode', 'LOT-A 001/23'],
  ['PDF417', 'pdf417', 'LOT-A 001/23'],
]) {
  test(`decodifica una imagen ${name} generada con BWIP y conserva su contenido`, async () => {
    const raw = bwip.raw({ bcid, text: code })[0];
    const scale = 4;
    const width = raw.pixx * scale + 80;
    const height = raw.pixy * scale + 80;
    const pixels = new Uint8ClampedArray(width * height).fill(255);
    for (let y = 0; y < raw.pixy; y++) {
      for (let x = 0; x < raw.pixx; x++) {
        if (!raw.pixs[y * raw.pixx + x]) continue;
        for (let dy = 0; dy < scale; dy++) {
          const start = (40 + y * scale + dy) * width + 40 + x * scale;
          pixels.fill(0, start, start + scale);
        }
      }
    }
    const result = await decode(pixels, width, height);
    assert.equal(result.text, code);
    assert.ok(result.format === name || (name === 'Aztec' && result.symbology === 'Aztec') || (name === 'QRCode' && result.symbology === 'QRCode'), result.format);
  });
}

for (const [bcid, code, expected, format] of [
  ['databaromni', '(01)09501101530003', '0109501101530003', 'DataBarOmni'],
  ['databarexpanded', '(01)09501101530003(10)ABC123', '010950110153000310ABC123', 'DataBarExp'],
  ['maxicode', 'ABC123', 'ABC123', 'MaxiCode'],
]) {
  test(`decodifica PNG ${bcid} generado por un motor independiente`, async () => {
    const png = await bwip.toBuffer({ bcid, text: code, scale: 4, padding: 20, backgroundcolor: 'FFFFFF' });
    const results = await readBarcodes(png, createCameraReaderOptions());
    assert.equal(results.length, 1);
    assert.equal(results[0].isValid, true);
    assert.equal(results[0].text, expected);
    assert.equal(results[0].format, format);
  });
}

test('una imagen sin código no produce una lectura de producto', async () => {
  const results = await readBarcodes({ data: new Uint8ClampedArray(100 * 100 * 4).fill(255), width: 100, height: 100 }, createCameraReaderOptions());
  assert.deepEqual(results, []);
});
