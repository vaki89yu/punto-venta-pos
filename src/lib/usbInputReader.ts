// En el modo USB explícito usamos el valor real del input, no el ritmo de keydown.
// Esto también permite lectores que insertan/pegan el código completo.
export function createUsbInputReader(
  onScan: (code: string) => void,
  idleMs: number | null = 800,
) {
  let value = "";
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  const pause = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };
  const submit = () => {
    pause();
    if (disposed) return;
    const code = value.trim();
    value = ""; // Vaciar antes del callback: Enter + LF no duplica la lectura.
    if (code) onScan(code);
  };

  return {
    update(nextValue: string) {
      if (disposed) return;
      pause();
      value = nextValue;
      if (value.trim() && idleMs !== null) timer = setTimeout(submit, idleMs);
    },
    submit,
    pause,
    dispose() {
      pause();
      value = "";
      disposed = true;
    },
  };
}
