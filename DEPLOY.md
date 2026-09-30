# Guía de base de datos y despliegue

El POS usa PostgreSQL para usuarios, catálogo, ventas, caja, devoluciones y operaciones. **No inicies sesión con credenciales de demostración ni uses el sistema como operativo hasta que `/api/health` confirme que la base está conectada.** La inicialización no inventa productos, ventas ni clientes.

## 1. Requisitos

- Node.js 20 o superior y npm.
- Un proyecto PostgreSQL administrado. Esta guía usa [Neon](https://neon.tech); también sirven Supabase u otro PostgreSQL accesible desde Vercel.
- El repositorio del POS en tu computadora.

## 2. Crear PostgreSQL en Neon

1. Crea un proyecto PostgreSQL en Neon.
2. Abre **Connection Details** y copia la cadena de conexión completa. Debe empezar con `postgresql://` y normalmente incluir `sslmode=require`.
3. Guarda la cadena como secreto: contiene usuario y contraseña de la base. No la pegues en mensajes, capturas ni archivos de Git.

Usa una base/proyecto distinto para **Preview** y **Production** si vas a probar cambios; así las pruebas no alteran los datos de la tienda.

## 3. Configurar las variables localmente

En la raíz del repositorio, crea `.env.local` (está excluido de Git):

```bash
cp .env.example .env.local
```

En Windows puedes copiar `.env.example` como `.env.local` desde el Explorador o PowerShell. Edita `.env.local` y sustituye los ejemplos por valores reales:

```dotenv
DATABASE_URL="postgresql://USUARIO:CONTRASENA@HOST/BASE?sslmode=require"
SESSION_SECRET="UN_SECRETO_ALEATORIO_LARGO_DE_32_CARACTERES_O_MAS"
INITIAL_ADMIN_EMAIL="tu-correo@negocio.com"
INITIAL_ADMIN_PASSWORD="UNA_CONTRASENA_UNICA_DE_14_CARACTERES_O_MAS"
INITIAL_ADMIN_NAME="Administrador"
STORE_NAME="Nombre de tu tienda"
```

Genera `SESSION_SECRET` con un generador criptográfico, por ejemplo:

```bash
openssl rand -base64 48
```

La contraseña inicial debe tener al menos 14 caracteres; no uses `admin123` ni una contraseña de ejemplo. No compartas estos secretos ni los agregues al repositorio.

## 4. Crear el esquema e inicializar la cuenta

Desde la raíz del proyecto:

```bash
npm install
npm run db:push
npm run db:initialize
```

- `db:push` crea o actualiza las tablas de PostgreSQL según `src/db/schema.ts`.
- `db:initialize` crea el primer administrador, la categoría **General** y los ajustes básicos de tienda. Es idempotente: si el correo ya existe, no cambia su contraseña ni su rol.
- No se generan ventas, clientes ni productos ficticios.

Si `db:push` propone o reporta un cambio destructivo, detente y revisa el cambio antes de aceptarlo. No ejecutes una migración sobre Production sin respaldo.

## 5. Probar localmente

```bash
npm run dev
```

Abre `http://localhost:3000/api/health`. Debe responder HTTP 200 con `"ok": true`, `"database": "connected"` y `"sessionConfigured": true`. Después abre `http://localhost:3000/login` e inicia sesión con el correo y la contraseña que definiste en `.env.local`.

Si el health check muestra `not_configured`, `schema_missing` o `sessionConfigured: false`, no uses el POS: revisa `DATABASE_URL`, `SESSION_SECRET` y que `db:push` haya terminado correctamente.

Para probar una venta en la base real, crea primero productos con datos propios, existencias y precios reales, abre caja y revisa que la venta aparezca después de recargar. Haz esta prueba en una base de prueba separada si no quieres conservarla en Production.

## 6. Configurar Vercel

1. Importa el repositorio en Vercel.
2. En **Project → Settings → Environment Variables**, define `DATABASE_URL` y `SESSION_SECRET` para los ambientes que vas a usar (**Production** y, si corresponde, **Preview**).
3. Para Preview, es preferible usar una base de prueba separada de Production.
4. Guarda las variables y vuelve a desplegar para que las funciones las reciban.
5. Abre `https://TU-DOMINIO/api/health`. No declares el POS listo hasta que responda HTTP 200 con `ok: true`.

La cuenta inicial se crea ejecutando `npm run db:initialize` contra la misma base configurada para el ambiente correspondiente. Los valores `INITIAL_ADMIN_EMAIL` y `INITIAL_ADMIN_PASSWORD` se necesitan para esa inicialización, no para cada inicio de sesión; no es necesario dejarlos en Vercel después si se inicializa desde una computadora segura.

## 7. Operación y seguridad

- Mantén estable `SESSION_SECRET`; cambiarlo invalida las sesiones activas.
- Restringe quién puede ver o editar las variables de entorno y habilita autenticación en Vercel.
- Configura copias de seguridad y verifica que puedas restaurarlas.
- No uses la misma base para pruebas y ventas reales.
- Los pagos con tarjeta y transferencia se registran como confirmados externamente: el POS no se conecta a terminales ni bancos. El timbrado CFDI requiere un PAC; registrar una solicitud no timbra una factura.
- El catálogo Open Food Facts es opcional y de referencia; los precios y existencias deben ser los de tu negocio.

## Catálogo Open Food Facts (opcional)

El catálogo de referencia se consulta paginado desde el servidor. Los productos importados aparecen inactivos y pendientes de precio; no completan precios ni existencias de tu tienda.

```bash
npm run catalog:import -- --all
npm run build
```

Atribución del catálogo y fotos: ODbL 1.0, DbCL 1.0 y CC BY-SA 3.0, respectivamente.
