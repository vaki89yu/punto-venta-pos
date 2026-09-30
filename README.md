# 🏪 Abarrotes La Esquina — Sistema POS

Sistema de Punto de Venta profesional para tiendas de abarrotes, construido con Next.js 16, TypeScript, Tailwind CSS y PostgreSQL (Drizzle ORM).

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![Tailwind](https://img.shields.io/badge/Tailwind-4.1-38bdf8)

---

## ✨ Funcionalidades

| Módulo | Descripción |
|---|---|
| 🛒 **Punto de Venta** | Venta rápida con escáner de códigos de barras por cámara o lector USB |
| 📷 **Escáner inteligente** | Detecta si el producto existe (→ carrito) o es nuevo (→ registro) |
| 📦 **Inventario** | 180+ productos mexicanos, ajustes de stock, alertas |
| 💰 **Caja** | Apertura, cierre, movimientos y corte imprimible |
| 🧾 **Tickets** | Ticket profesional imprimible y descargable en PDF |
| ↩️ **Devoluciones** | Reembolsos con reintegro automático al inventario |
| 🚚 **Proveedores** | Directorio y órdenes de compra |
| 🏷️ **Etiquetas** | Generador de etiquetas con código de barras EAN-13 |
| 📊 **Reportes** | Exportación a Excel, CSV y PDF |
| ⭐ **Lealtad** | Programa de puntos con 4 niveles |
| 👥 **Usuarios** | 4 roles con permisos por módulo |
| 📱 **Móvil** | Totalmente responsive, funciona como app |

---

## 📷 Lectura multiformato

La cámara usa **ZXing-C++ (WebAssembly)** con todos los formatos legibles de esa versión habilitados: EAN/UPC (incluido UPC-E), Code 39/93/128, ITF, Codabar, GS1 DataBar y sus variantes, QR/Micro QR/rMQR, Data Matrix, Aztec, PDF417, MaxiCode, entre otros compatibles. Detecta rotaciones e inversión de color y rechaza resultados con errores. No se garantiza leer cualquier simbología propietaria ni códigos borrosos o dañados.

- El motor se carga al abrir la cámara, **desde el propio sitio**, sin depender de un CDN. `npm install` / `npm ci` ejecutan `scripts/prepare-scanner.mjs` para copiar el WASM a `public/scanner/`; si omites scripts de instalación ejecuta `npm run postinstall` antes de desarrollar o desplegar.
- Se conserva el texto del código: letras, ceros iniciales, guiones, espacios internos y símbolos. Primero se busca una coincidencia exacta y después la equivalencia UPC-A/EAN-13 con prefijo cero. No se recortan códigos largos para evitar vender un producto distinto.
- UPC-E se conserva con sus 8 dígitos cuando el motor identifica ese formato. El código leído por cámara y por USB puede usarse como identificador de producto.
- Los QR y los datos GS1 se tratan como identificadores de texto, no como instrucciones: no se abren enlaces ni se extraen automáticamente precios, lotes o GTIN de su contenido. Un código desconocido abre el registro de producto.
- Los códigos guardados por versiones anteriores que ya perdieron guiones/espacios no se pueden reconstruir automáticamente; corrige el campo de código en Inventario si no coincide con la etiqueta.
- **El USB depende del hardware:** se acepta el texto que envíe un lector HID. Un lector láser 1D no se convierte en lector QR/2D mediante software. Si no escribe en el Bloc de notas, hay que resolver su configuración o conexión; ampliar formatos en la aplicación no corrige eso.

### Pruebas de formatos

`npm run test:scanner` ejecuta 50 pruebas: captura USB, conservación/búsqueda de códigos y decodificación de imágenes generadas con **JsBarcode y BWIP-JS**, independientes del motor de lectura. Incluye EAN-13/8, UPC-A/E, Code 128/39/93, ITF, Codabar, QR, Micro QR, Data Matrix, Aztec, PDF417, DataBar Omni/Expanded y MaxiCode. También se verificó en Chromium el flujo cámara→carrito con una cámara simulada, el archivo WASM local, USB alfanumérico y la liberación de la cámara al cerrar. Falta validar con el lector y la cámara físicos del usuario.

---

## 🔌 Lector de códigos USB (Nextep en modo teclado HID)

1. Conecta el lector en **modo teclado USB HID**. Si necesitas cambiar su configuración, usa el manual de su modelo exacto, no códigos de otro lector.
2. En **Punto de Venta**, pulsa **Escáner USB**. El botón sólo enfoca el campo de código; no abre una ventana adicional ni requiere cámara o WebUSB.
3. Escanea una etiqueta impresa. El campo procesa directamente la lectura: un producto existente con stock se agrega al carrito; uno agotado muestra un aviso; un código nuevo abre el registro rápido.
4. Escanea varias veces el mismo producto para aumentar su cantidad. No necesitas activar «Continuo», que corresponde a la cámara.

El campo procesa el valor real que escribe el lector, incluso si la lectura es lenta o se inserta completa. Enter o Tab procesan inmediatamente la lectura y limpian el campo sin duplicarla; si el lector no envía terminador, el código se procesa automáticamente tras 800 ms sin cambios. Al perder el foco se pausa la lectura automática.

Fuera del campo de código, el detector global sigue aceptando ráfagas de al menos 3 caracteres con un máximo de 100 ms entre teclas, terminadas en Enter/Tab, sólo cuando no estás editando otro campo ni hay diálogos abiertos.

### Verificación

- `npm run test:scanner` (Node.js 22.6+): pruebas de captura, terminadores, lectura sin Enter, pausas, duplicados, códigos pegados, formatos de imagen y limpieza al cerrar.
- `npm run typecheck`: comprobación de TypeScript.
- Validación adicional en Chromium con teclado simulado: enfoque, lectura lenta, Enter/Tab, lectura sin terminador, modo de prueba, agotados, registro de códigos nuevos, retorno al escáner y cancelación al cerrar. **Pendiente probar con el lector físico del usuario.**

---

## 🗄️ PostgreSQL, administrador inicial y Vercel

El sistema necesita PostgreSQL y una sesión firmada para operar. No hay una contraseña ni un conjunto de ventas ficticias predeterminados. Sigue la [guía paso a paso de PostgreSQL y despliegue](DEPLOY.md): crea `.env.local` con tus secretos, ejecuta `npm run db:push` y luego `npm run db:initialize`. El inicializador crea solo el primer administrador, una categoría inicial y los ajustes básicos; no crea ventas ni productos de demostración.

En Vercel configura `DATABASE_URL` y `SESSION_SECRET` en los ambientes necesarios y vuelve a desplegar. Antes de usar el POS, verifica `/api/health`: debe responder `ok: true`, `database: "connected"` y `sessionConfigured: true`. No compartas ni subas las credenciales; `.env.local` está excluido de Git.

La fuente Inter se sirve localmente mediante `@fontsource-variable/inter`; la compilación no necesita descargar fuentes de Google Fonts.

---

## 📁 Estructura del proyecto

```
src/
├── app/                    # Rutas (App Router)
│   ├── pos/               # Punto de venta
│   ├── inventory/         # Inventario
│   ├── sales/             # Historial de ventas
│   ├── returns/           # Devoluciones
│   ├── customers/         # Clientes
│   ├── suppliers/         # Proveedores
│   ├── purchase-orders/   # Órdenes de compra
│   ├── labels/            # Generador de etiquetas
│   ├── cash/              # Control de caja
│   ├── reports/           # Reportes y exportación
│   ├── loyalty/           # Programa de lealtad
│   └── users/             # Gestión de usuarios
├── components/
│   ├── ui/                # Componentes reutilizables
│   ├── layout/            # Sidebar, Header, notificaciones
│   ├── pos/               # Carrito, checkout, ticket
│   ├── scanner/           # Escáner de códigos de barras
│   ├── dashboard/         # Gráficas y métricas
│   └── inventory/         # Ajuste de stock
├── contexts/              # Auth, Cart, Theme
├── hooks/                 # Lógica de negocio
├── db/                    # Esquema Drizzle ORM
├── data/                  # Catálogo de productos
├── lib/                   # Utilidades y exportación
└── types/                 # Tipos TypeScript
```

---

## 🛠️ Stack tecnológico

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Lenguaje:** TypeScript
- **Estilos:** Tailwind CSS 4
- **Base de datos:** PostgreSQL + Drizzle ORM
- **Escáner:** ZXing-C++ / zxing-wasm (cámara multiformato) y lectores USB HID
- **Gráficas:** Recharts
- **Exportación:** jsPDF, SheetJS (xlsx)
- **Animaciones:** Framer Motion
- **Iconos:** Lucide React

---

## 📝 Notas

- Los datos de demostración se guardan en `localStorage` del navegador
- El esquema de PostgreSQL está listo en `src/db/schema.ts` para migrar a persistencia real
- Para usar la cámara se requiere **HTTPS** (Vercel lo provee automáticamente)

---

## 🗃️ Catálogo Open Food Facts (México)

El inventario puede enriquecerse con datos de producto de [Open Food Facts](https://world.openfoodfacts.org)
(código de barras, nombre, marca, presentación, categoría y foto).

```bash
# Importa el catálogo real de México (requiere acceso a openfoodfacts.org)
npm run catalog:import -- --all
```

Reglas de integración:

- El catálogo vive en `src/data/openFoodFactsMexico.json` y se sirve **paginado** desde
  `/api/catalog/openfoodfacts` — nunca se envía completo al navegador ni se guarda en `localStorage`.
- Los productos importados aparecen **inactivos y pendientes de precio** en Inventario.
- **Los precios y existencias nunca provienen de Open Food Facts**: son datos propios de la tienda.
- Los códigos de barras se validan con dígitos de control GTIN y se deduplican (UPC-A ≡ EAN-13 con 0 inicial).

### Atribución obligatoria

Los datos de Open Food Facts se usan bajo las siguientes licencias, visibles también en la
aplicación (Inventario y Configuración):

- **Base de datos:** [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/)
- **Contenido de la base de datos:** [Database Contents License (DbCL) 1.0](https://opendatacommons.org/licenses/dbcl/1-0/)
- **Fotografías:** [Creative Commons Attribution-ShareAlike (CC BY-SA) 3.0](https://creativecommons.org/licenses/by-sa/3.0/)

© Open Food Facts Contributors · [Términos de uso](https://world.openfoodfacts.org/terms-of-use)

---

## 📄 Licencia

MIT
