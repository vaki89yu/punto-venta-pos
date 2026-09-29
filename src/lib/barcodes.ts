/** Conserva letras, símbolos, guiones, espacios internos y ceros iniciales. */
export function normalizeBarcode(code: string): string {
  return (code || "").trim();
}

/** Sólo UPC-A y EAN-13 con prefijo 0 son representaciones equivalentes. */
export function barcodeVariants(code: string): string[] {
  const clean = normalizeBarcode(code);
  if (!clean) return [];
  if (/^\d{12}$/.test(clean)) return [clean, `0${clean}`];
  if (/^0\d{12}$/.test(clean)) return [clean, clean.slice(1)];
  return [clean];
}

/** Prioriza coincidencias exactas para no elegir otro producto del catálogo. */
export function findBarcodeMatch<T extends { barcode: string }>(products: T[], code: string): T | undefined {
  const variants = barcodeVariants(code);
  for (const variant of variants) {
    const match = products.find((product) => normalizeBarcode(product.barcode) === variant);
    if (match) return match;
  }
  return undefined;
}

/** ZXing-C++ entrega UPC-E expandido a EAN-13. Recuperar sus 8 dígitos
 * sólo cuando el decodificador confirmó UPC-E (nunca inferirlo por longitud). */
export function cameraBarcodeText(result: { format: string; text: string }): string {
  if (result.format !== "UPCE") return result.text;
  const upca = /^0[01]\d{11}$/.test(result.text) ? result.text.slice(1) : result.text;
  if (!/^[01]\d{11}$/.test(upca)) return result.text;
  const manufacturer = upca.slice(1, 6);
  const item = upca.slice(6, 11);
  let compressed: string;
  if (/^[0-2]00$/.test(manufacturer.slice(2)) && item.startsWith("00")) {
    compressed = manufacturer.slice(0, 2) + item.slice(2) + manufacturer[2];
  } else if (manufacturer.endsWith("00") && item.startsWith("000")) {
    compressed = manufacturer.slice(0, 3) + item.slice(3) + "3";
  } else if (manufacturer.endsWith("0") && item.startsWith("0000")) {
    compressed = manufacturer.slice(0, 4) + item[4] + "4";
  } else if (/^0000[5-9]$/.test(item)) {
    compressed = manufacturer + item[4];
  } else {
    return result.text;
  }
  return upca[0] + compressed + upca[11];
}
