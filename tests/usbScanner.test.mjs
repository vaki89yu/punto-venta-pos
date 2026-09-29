import assert from 'node:assert/strict';
import test from 'node:test';
import { createUsbScanBuffer, listenForUsbScanner } from '../src/lib/usbScanner.ts';

function scan(buffer, code, { start = 0, interval = 10, suffix = 'Enter' } = {}) {
  let time = start;
  for (const key of code) {
    assert.equal(buffer.push(key, time), null);
    time += interval;
  }
  return buffer.push(suffix, time);
}

test('Enter y Tab conservan ceros iniciales y códigos alfanuméricos', () => {
  const buffer = createUsbScanBuffer();
  assert.equal(scan(buffer, '0012345678905'), '0012345678905');
  assert.equal(scan(buffer, 'SKU-ABC123', { start: 500, suffix: 'Tab' }), 'SKU-ABC123');
});

test('cada lectura agrega una unidad, incluyendo el mismo código consecutivo', () => {
  const buffer = createUsbScanBuffer();
  assert.equal(scan(buffer, '7501055300077'), '7501055300077');
  assert.equal(scan(buffer, '7501055300077', { start: 200 }), '7501055300077');
  assert.equal(buffer.push('Enter', 340), null);
});

test('no considera escritura lenta, teclas aisladas ni un terminador tardío como lectura', () => {
  const buffer = createUsbScanBuffer();
  assert.equal(scan(buffer, '12345678', { interval: 150 }), null);
  assert.equal(scan(buffer, '12', { start: 2000 }), null);
  for (const [index, key] of [...'12345678'].entries()) buffer.push(key, 3000 + index * 10);
  assert.equal(buffer.push('Enter', 4000), null);
});

test('Escape, cambio de foco y reinicio descartan lecturas parciales', () => {
  const buffer = createUsbScanBuffer();
  for (const key of '1234') buffer.push(key, 10);
  buffer.push('Escape', 20);
  assert.equal(buffer.push('Enter', 30), null);
  for (const key of '1234') buffer.push(key, 40);
  buffer.reset();
  assert.equal(buffer.push('Enter', 50), null);
});

test('Shift permite códigos con mayúsculas', () => {
  const buffer = createUsbScanBuffer();
  buffer.push('a', 0);
  buffer.push('Shift', 10);
  buffer.push('B', 20);
  buffer.push('3', 30);
  assert.equal(buffer.push('Tab', 40), 'aB3');
});

function fakeWindow() {
  const listeners = new Map();
  return {
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name, callback) {
      assert.equal(listeners.get(name), callback);
      listeners.delete(name);
    },
    emit(name, event = {}) { listeners.get(name)?.(event); },
    listeners,
  };
}

function send(target, code, options = {}) {
  let prevented = 0;
  let stopped = 0;
  for (const [index, key] of [...code, 'Enter'].entries()) {
    target.emit('keydown', {
      key, timeStamp: index * 10,
      preventDefault() { prevented++; },
      stopImmediatePropagation() { stopped++; },
      ...options,
    });
  }
  return { prevented, stopped };
}

test('intercepta sólo el terminador y elimina listeners al desmontar', () => {
  const target = fakeWindow();
  const codes = [];
  const cleanup = listenForUsbScanner(target, { onScan: code => codes.push(code), shouldIgnore: () => false });
  assert.deepEqual(send(target, '7501055300077'), { prevented: 1, stopped: 1 });
  assert.deepEqual(codes, ['7501055300077']);
  cleanup();
  assert.equal(target.listeners.size, 0);
  send(target, '12345678');
  assert.equal(codes.length, 1);
});

test('respeta campos editables, modales, atajos, composición y repetición', () => {
  const target = fakeWindow();
  const codes = [];
  let ignore = true;
  const cleanup = listenForUsbScanner(target, { onScan: code => codes.push(code), shouldIgnore: () => ignore });
  assert.deepEqual(send(target, '12345678'), { prevented: 0, stopped: 0 });
  ignore = false;
  for (const flag of ['ctrlKey', 'altKey', 'metaKey', 'isComposing', 'repeat', 'defaultPrevented']) {
    assert.deepEqual(send(target, '12345678', { [flag]: true }), { prevented: 0, stopped: 0 });
  }
  assert.deepEqual(codes, []);
  send(target, '12345678');
  assert.deepEqual(codes, ['12345678']);
  cleanup();
});

test('perder foco o cambiar de campo cancela una lectura parcial', () => {
  for (const event of ['blur', 'focusin']) {
    const target = fakeWindow();
    const codes = [];
    const cleanup = listenForUsbScanner(target, { onScan: code => codes.push(code), shouldIgnore: () => false });
    for (const key of '12345') target.emit('keydown', { key, timeStamp: 0 });
    target.emit(event);
    target.emit('keydown', { key: 'Enter', timeStamp: 10 });
    assert.deepEqual(codes, []);
    cleanup();
  }
});
