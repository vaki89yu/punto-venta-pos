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

## 🔌 Lector de códigos USB

1. Conecta el lector y configúralo en **modo teclado USB HID**, con **Enter o Tab como terminador** (consulta los códigos de configuración de su manual).
2. Abre **Punto de Venta** y mantén la ventana del navegador activa. No requiere permisos de cámara ni WebUSB.
3. Escanea el producto: usa la misma búsqueda y flujo que la cámara. Un producto existente con stock se agrega al carrito; uno agotado muestra un aviso; un código nuevo abre el registro rápido.
4. Puedes escanear varias veces el mismo producto para aumentar su cantidad. No necesitas activar el botón «Continuo», que corresponde a la cámara.

El lector se escucha automáticamente cuando no estás editando otro campo y no hay diálogos abiertos. Si estás escribiendo una búsqueda o cantidad, pulsa **Escáner USB** para enfocar el campo de código antes de escanear. El botón muestra instrucciones de uso y enfoca el campo de código. Ese campo también acepta códigos escritos o pegados, confirmados con Enter o Tab, y lectores configurados con una velocidad lenta.

**Compatibilidad:** la detección automática reconoce ráfagas de al menos 3 caracteres, con un máximo de 100 ms entre teclas y el terminador. El campo dedicado no impone ese ritmo ni longitud mínima. Los lectores en modo serie/COM o con protocolo propietario deben cambiarse a HID; no se accede directamente al dispositivo ni se muestra un estado de conexión físico, porque el navegador recibe sus lecturas como teclas. Sin terminador, configura Enter o Tab en el lector.

### Verificación del lector

- `npm run test:scanner` (Node.js 22.6+): pruebas de ráfagas, Enter/Tab, ceros iniciales, códigos alfanuméricos, lecturas repetidas, escritura normal, interrupciones y limpieza de listeners.
- En Punto de Venta, escanea un código registrado dos veces: debe aumentar dos unidades, sin abrir el cobro aunque ese botón tenga el foco.
- Prueba un producto agotado y un código nuevo: deben mostrar el aviso y el registro, respectivamente.
- Pulsa **Escáner USB** y prueba Enter y Tab: cada lectura debe agregar una sola unidad y limpiar el campo.
- Comprueba que no se agregan productos al escribir en búsquedas o mientras están abiertos el cobro, el registro o la cámara. Verifica también que el escáner de cámara sigue funcionando.

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
