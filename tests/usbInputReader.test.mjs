import assert from 'node:assert/strict';
import test from 'node:test';
import { createUsbInputReader } from '../src/lib/usbInputReader.ts';

function setup(t, idleMs) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const codes = [];
  const reader = createUsbInputReader(code => codes.push(code), idleMs);
  t.after(() => reader.dispose());
  return { reader, codes };
}

test('lectura lenta no pierde caracteres como el detector global de 100 ms', t => {
  const { reader, codes } = setup(t);
  let value = '';
  for (const char of '0012345678905') {
    value += char;
    reader.update(value);
    t.mock.timers.tick(200);
  }
  reader.submit();
  assert.deepEqual(codes, ['0012345678905']);
});

test('procesa lectores sin terminador después de la pausa', t => {
  const { reader, codes } = setup(t);
  reader.update('7501055300077');
  t.mock.timers.tick(799);
  assert.deepEqual(codes, []);
  t.mock.timers.tick(1);
  assert.deepEqual(codes, ['7501055300077']);
});

test('Enter, Tab, CR/LF o un terminador tardío no duplican la lectura', t => {
  const { reader, codes } = setup(t);
  reader.update('7501055300077');
  reader.submit();
  reader.submit();
  t.mock.timers.tick(1000);
  reader.submit();
  assert.deepEqual(codes, ['7501055300077']);
});

test('cada cambio reinicia el tiempo de espera; no procesa un código parcial', t => {
  const { reader, codes } = setup(t);
  reader.update('750105');
  t.mock.timers.tick(700);
  reader.update('7501055300077');
  t.mock.timers.tick(700);
  assert.deepEqual(codes, []);
  t.mock.timers.tick(100);
  assert.deepEqual(codes, ['7501055300077']);
});

test('lecturas consecutivas iguales cuentan dos unidades sin debounce', t => {
  const { reader, codes } = setup(t);
  reader.update('ABC-001');
  reader.submit();
  reader.update('ABC-001');
  reader.submit();
  assert.deepEqual(codes, ['ABC-001', 'ABC-001']);
});

test('el modo con terminador no impone una velocidad ni un tiempo máximo', t => {
  const { reader, codes } = setup(t, null);
  reader.update('123');
  t.mock.timers.tick(5000);
  reader.update('123456');
  t.mock.timers.tick(5000);
  assert.deepEqual(codes, []);
  reader.submit();
  assert.deepEqual(codes, ['123456']);
});

test('procesa valores pegados y conserva ceros iniciales', t => {
  const { reader, codes } = setup(t);
  reader.update('0012345678905\r\n');
  reader.submit();
  assert.deepEqual(codes, ['0012345678905']);
});

test('perder foco pausa el envío automático pero permite confirmar manualmente', t => {
  const { reader, codes } = setup(t);
  reader.update('123456');
  reader.pause();
  t.mock.timers.tick(2000);
  assert.deepEqual(codes, []);
  reader.submit();
  assert.deepEqual(codes, ['123456']);
});

test('cerrar el diálogo cancela pendientes y bloquea callbacks tardíos', t => {
  const { reader, codes } = setup(t);
  reader.update('123456');
  reader.dispose();
  t.mock.timers.tick(2000);
  reader.submit();
  reader.update('987654');
  t.mock.timers.tick(2000);
  assert.deepEqual(codes, []);
});

test('borrar el campo cancela la lectura; espacios y Enter vacío no agregan', t => {
  const { reader, codes } = setup(t);
  reader.update('123456');
  reader.update('');
  t.mock.timers.tick(2000);
  reader.update('  ');
  reader.submit();
  assert.deepEqual(codes, []);
});
