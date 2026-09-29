import type { ReaderOptions } from "zxing-wasm/reader";

export const CAMERA_FORMAT_LABELS = "EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39, Code 93, ITF, Codabar, GS1 DataBar, QR, Micro QR, rMQR, Data Matrix, Aztec, PDF417, MaxiCode y otros formatos compatibles con ZXing-C++";

/** Todos los formatos legibles del motor, sin aceptar resultados con errores. */
export function createCameraReaderOptions(): ReaderOptions {
  return {
    formats: ["AllReadable"],
    tryHarder: true,
    tryRotate: true,
    tryInvert: true,
    maxNumberOfSymbols: 1,
    returnErrors: false,
    textMode: "Plain",
    // El suplemento de precio de un EAN no forma parte del identificador de producto.
    eanAddOnSymbol: "Ignore",
  };
}
