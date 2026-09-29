let decoderPromise: Promise<typeof import("zxing-wasm/reader")> | undefined;

/** Carga diferida, compartida y desde el mismo sitio (también en Vercel). */
export function loadCameraDecoder() {
  decoderPromise ??= import("zxing-wasm/reader").then(async (decoder) => {
    await decoder.prepareZXingModule({
      overrides: {
        locateFile: () => `/scanner/zxing_reader.wasm?v=${decoder.ZXING_WASM_SHA256}`,
      },
      fireImmediately: true,
    });
    return decoder;
  }).catch((error) => {
    decoderPromise = undefined; // Permitir reintento si falló la descarga.
    throw error;
  });
  return decoderPromise;
}
