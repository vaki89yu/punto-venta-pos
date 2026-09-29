// Los lectores USB HID envían ráfagas de teclas terminadas en Enter o Tab.
// Fuera del campo dedicado exigimos una ráfaga rápida para no confundir
// escritura normal con una lectura. En el campo dedicado no hay límite de ritmo.
const MAX_KEY_INTERVAL_MS = 100;
const MIN_SCAN_LENGTH = 3;
const MAX_SCAN_LENGTH = 256;

export function createUsbScanBuffer() {
  let buffer = "";
  let lastTime = 0;

  const reset = () => {
    buffer = "";
    lastTime = 0;
  };

  return {
    reset,
    push(key: string, time: number): string | null {
      if (time - lastTime > MAX_KEY_INTERVAL_MS) reset();
      if (key === "Enter" || key === "Tab") {
        const code = buffer.length >= MIN_SCAN_LENGTH ? buffer : null;
        reset();
        return code;
      }
      // Shift es habitual en códigos alfanuméricos y no rompe la lectura.
      if (key === "Shift") return null;
      if (key.length !== 1 || buffer.length >= MAX_SCAN_LENGTH) {
        reset();
        return null;
      }
      buffer += key;
      lastTime = time;
      return null;
    },
  };
}

interface UsbScannerOptions {
  onScan: (code: string) => void;
  shouldIgnore: (event: KeyboardEvent) => boolean;
}

/** Captura sólo el terminador reconocido; nunca intercepta escritura normal. */
export function listenForUsbScanner(target: Window, options: UsbScannerOptions) {
  const buffer = createUsbScanBuffer();
  const onKeyDown = (event: KeyboardEvent) => {
    if (
      event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey ||
      event.isComposing || event.repeat || options.shouldIgnore(event)
    ) {
      buffer.reset();
      return;
    }
    const code = buffer.push(event.key, event.timeStamp);
    if (code !== null) {
      // No enviar formularios ni pulsar el botón que tenga el foco.
      event.preventDefault();
      event.stopImmediatePropagation();
      options.onScan(code);
    }
  };
  const reset = () => buffer.reset();
  target.addEventListener("keydown", onKeyDown, true);
  target.addEventListener("blur", reset);
  target.addEventListener("focusin", reset);
  return () => {
    target.removeEventListener("keydown", onKeyDown, true);
    target.removeEventListener("blur", reset);
    target.removeEventListener("focusin", reset);
    buffer.reset();
  };
}
