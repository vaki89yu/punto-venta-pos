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

## 🔌 Lector de códigos USB (Nextep en modo teclado HID)

1. Conecta el lector en **modo teclado USB HID**. Si necesitas cambiar su configuración, usa el manual de su modelo exacto, no códigos de otro lector.
2. Abre **Punto de Venta → Escáner USB**. Se abre una ventana dedicada y se enfoca el campo que recibe los códigos. No requiere cámara ni WebUSB.
3. Escanea una etiqueta impresa. El campo muestra los caracteres recibidos y el panel conserva la última lectura. Un producto existente con stock se agrega al carrito; uno agotado muestra un aviso; un código nuevo abre el registro rápido. Al cerrar el registro vuelve la ventana USB.
4. Escanea varias veces el mismo producto para aumentar su cantidad. No necesitas activar «Continuo», que corresponde a la cámara.

### Lectores lentos o sin Enter

La ventana USB usa el **valor real del campo**, no la detección de ráfagas rápidas. Admite lectores que escriben lentamente o insertan el código completo. Enter o Tab procesan inmediatamente la lectura y limpian el campo sin duplicarla.

Por defecto, **Leer también sin Enter** procesa el código tras **800 ms sin cambios**. Para escribir manualmente o usar un lector que haga pausas de 800 ms o más dentro del código, desactiva esa opción y confirma con Enter, Tab o **Procesar código**. Si tu lector no envía terminador, deja al menos esa pausa entre productos; configurar Enter es lo más fiable para lecturas consecutivas.

La captura automática se pausa al perder el foco, cambiar de ventana o abrir el registro de un producto nuevo. Usa **Continuar escaneando** para volver al campo. Al cerrar la ventana se cancelan todas las lecturas pendientes.

Fuera de esta ventana, el detector global sigue aceptando ráfagas de al menos 3 caracteres con un máximo de 100 ms entre teclas, terminadas en Enter/Tab, sólo cuando no estás editando otro campo ni hay diálogos abiertos.

### Diagnóstico del Nextep

- Activa **Probar lector sin agregar productos al carrito**. Escanea y comprueba el texto de **Código recibido**.
- Si no aparecen caracteres, abre el Bloc de notas y escanea una etiqueta impresa. Si tampoco escribe ahí, revisa el cable, otro puerto USB y la configuración de teclado HID. Indica el modelo exacto que aparece en la etiqueta del dispositivo para consultar sus instrucciones.
- Los lectores en modo serie/COM o con protocolo propietario necesitan cambiar a HID o una integración específica. La aplicación no detecta físicamente la conexión USB: «Campo listo» significa que el campo tiene el foco, no que se haya detectado un dispositivo.

### Verificación

- `npm run test:scanner` (Node.js 22.6+): 18 pruebas de captura, terminadores, lectura sin Enter, pausas, duplicados, códigos pegados y limpieza al cerrar.
- `npm run typecheck`: comprobación de TypeScript.
- Validación adicional en Chromium con teclado simulado: enfoque, lectura lenta, Enter/Tab, lectura sin terminador, modo de prueba, agotados, registro de códigos nuevos, retorno al escáner y cancelación al cerrar. **Pendiente probar con el lector físico del usuario.**

---

## 🚀 Despliegue en Vercel

### 1. Subir a GitHub

```bash
git init
git add .
git commit -m "Sistema POS Abarrotes La Esquina"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/pos-abarrotes.git
git push -u origin main
```

### 2. Crear base de datos

Opciones gratuitas compatibles con Vercel:

- **[Neon](https://neon.tech)** (recomendado) — PostgreSQL serverless
- **[Supabase](https://supabase.com)**
- **Vercel Postgres** (desde el dashboard de Vercel)

Copia la cadena de conexión (`DATABASE_URL`).

### 3. Importar en Vercel

1. Entra a [vercel.com/new](https://vercel.com/new)
2. Selecciona **Import Git Repository** → elige tu repo
3. En **Environment Variables** agrega:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | `postgresql://...` (tu cadena de conexión) |

4. Haz clic en **Deploy**

### 4. Aplicar el esquema de la base de datos

Una vez desplegado, desde tu máquina local:

```bash
# Crea un archivo .env con la DATABASE_URL de producción
echo 'DATABASE_URL="postgresql://..."' > .env

npx drizzle-kit push
```

---

## 💻 Desarrollo local

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Edita .env con tu DATABASE_URL

# 3. Aplicar esquema a la base de datos
npx drizzle-kit push

# 4. Iniciar servidor de desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

---

## 🔑 Credenciales de demostración

| Rol | Email | Contraseña |
|---|---|---|
| Administrador | `admin@pos.com` | `admin123` |
| Gerente | `gerente@pos.com` | `gerente123` |
| Cajero | `cajero@pos.com` | `cajero123` |

> ⚠️ **Importante:** Cambia estas credenciales antes de usar en producción real.

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
- **Escáner:** @zxing/browser (EAN-13, UPC, Code 128, QR)
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

## 📄 Licencia

MIT
