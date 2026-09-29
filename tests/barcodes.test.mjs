import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeBarcode, barcodeVariants, findBarcodeMatch } from '../src/lib/barcodes.ts';

const codes = ['ABC-123', 'ABC 123', 'abc/123+X', '00123', 'https://example.test/p/A-B?lot=01', '(01)07501055300077(10)LOT-A', '010750105530007710LOT-A\u001d17271231'];
for (const code of codes) {
  test(`conserva contenido y busca exactamente: ${JSON.stringify(code)}`, () => {
    assert.equal(normalizeBarcode(` ${code}\r\n`), code);
    const product = { barcode: code };
    assert.equal(findBarcodeMatch([product], code), product);
  });
}

test('no confunde símbolos, espacios, mayúsculas o ceros iniciales', () => {
  const products = [{ barcode: 'ABC123' }, { barcode: '123' }];
  for (const code of ['ABC-123', 'ABC 123', 'abc123', '00123']) {
    assert.equal(findBarcodeMatch(products, code), undefined);
  }
});

test('sólo UPC-A y su EAN-13 con cero inicial son equivalentes', () => {
  assert.deepEqual(barcodeVariants('012345678905'), ['012345678905', '0012345678905']);
  assert.equal(findBarcodeMatch([{ barcode: '0012345678905' }], '012345678905')?.barcode, '0012345678905');
  assert.equal(findBarcodeMatch([{ barcode: '012345678905' }], '0012345678905')?.barcode, '012345678905');
  assert.deepEqual(barcodeVariants('000123'), ['000123']);
});

test('la coincidencia exacta gana aunque haya una variante antes en el catálogo', () => {
  const products = [{ barcode: '012345678905' }, { barcode: '0012345678905' }];
  assert.equal(findBarcodeMatch(products, '0012345678905'), products[1]);
});

test('no recorta ITF-14, GS1, URL ni códigos largos para buscar otro producto', () => {
  const products = [{ barcode: '123456789012' }];
  for (const code of ['99123456789012', 'ABC123456789012', 'https://example.test/123456789012']) {
    assert.equal(findBarcodeMatch(products, code), undefined);
  }
});

test('códigos vacíos no coinciden con productos sin código', () => {
  assert.equal(findBarcodeMatch([{ barcode: '' }], ' \r\n'), undefined);
});

test('no interpreta un EAN-8 ni texto QR como un UPC-E', async () => {
  const { cameraBarcodeText } = await import('../src/lib/barcodes.ts');
  assert.equal(cameraBarcodeText({ format: 'UPCE', text: '0042100005264' }), '04252614');
  assert.equal(cameraBarcodeText({ format: 'EAN13', text: '0042100005264' }), '0042100005264');
  assert.equal(cameraBarcodeText({ format: 'QRCode', text: 'LOT-01 / A' }), 'LOT-01 / A');
});
