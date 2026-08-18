# 🚀 Guía de Despliegue — Paso a Paso

Guía completa para poner en marcha el Sistema POS en producción con GitHub + Vercel.

**Tiempo estimado:** 15–20 minutos
**Costo:** $0 (todo con planes gratuitos)

---

## 📋 Requisitos previos

Antes de empezar necesitas:

- [ ] **Node.js 20+** instalado → [nodejs.org](https://nodejs.org)
- [ ] **Git** instalado → [git-scm.com](https://git-scm.com)
- [ ] Cuenta de **GitHub** → [github.com/signup](https://github.com/signup)
- [ ] Cuenta de **Vercel** → [vercel.com/signup](https://vercel.com/signup) (entra con GitHub)

Verifica que tengas todo:

```bash
node --version    # debe mostrar v20.x o superior
git --version     # debe mostrar 2.x
```

---

## PASO 1 · Descargar el proyecto a tu computadora

Descarga los archivos del proyecto y colócalos en una carpeta, por ejemplo:

```
C:\Proyectos\pos-abarrotes     (Windows)
~/Proyectos/pos-abarrotes      (Mac/Linux)
```

Abre una terminal **dentro de esa carpeta**:

- **Windows:** clic derecho en la carpeta → "Abrir en Terminal"
- **Mac:** clic derecho → "Nuevo terminal en la carpeta"

---

## PASO 2 · Crear la base de datos (Neon)

### 2.1 Crear cuenta

1. Entra a **[neon.tech](https://neon.tech)**
2. Clic en **Sign Up** → entra con GitHub
3. Clic en **Create a project**

### 2.2 Configurar el proyecto

| Campo | Valor |
|---|---|
| Project name | `pos-abarrotes` |
| Postgres version | `16` (por defecto) |
| Region | `US East (Ohio)` — la más cercana a Vercel |

Clic en **Create project**

### 2.3 Copiar la cadena de conexión

Verás una pantalla con **Connection string**. Copia el texto completo:

```
postgresql://neondb_owner:AbC123xyz@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require
```

> 📌 **Guárdala en un bloc de notas.** La usarás 2 veces.

---

## PASO 3 · Configurar el proyecto localmente

### 3.1 Instalar dependencias

En la terminal, dentro de la carpeta del proyecto:

```bash
npm install
```

Espera 1–2 minutos.

### 3.2 Crear el archivo `.env`

**Windows (PowerShell):**
```powershell
echo 'DATABASE_URL="PEGA_AQUI_TU_CADENA_DE_NEON"' > .env
```

**Mac / Linux:**
```bash
echo 'DATABASE_URL="PEGA_AQUI_TU_CADENA_DE_NEON"' > .env
```

> ⚠️ Reemplaza `PEGA_AQUI_TU_CADENA_DE_NEON` por la cadena real de Neon.

El archivo `.env` debe quedar así:
```
DATABASE_URL="postgresql://neondb_owner:AbC123xyz@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

### 3.3 Crear las tablas en la base de datos

```bash
npm run db:push
```

Deberías ver:
```
[✓] Changes applied
```

### 3.4 Probar que funciona localmente

```bash
npm run dev
```

Abre **[http://localhost:3000](http://localhost:3000)**

Inicia sesión con:
- Email: `admin@pos.com`
- Contraseña: `admin123`

✅ Si ves el dashboard, todo va bien. Detén el servidor con `Ctrl + C`.

---

## PASO 4 · Subir el proyecto a GitHub

### 4.1 Crear el repositorio en GitHub

1. Entra a **[github.com/new](https://github.com/new)**
2. Llena los campos:

   | Campo | Valor |
   |---|---|
   | Repository name | `pos-abarrotes` |
   | Description | `Sistema POS para tienda de abarrotes` |
   | Visibilidad | **Private** (recomendado) o Public |
   | Initialize with README | ❌ **NO marcar** |
   | Add .gitignore | ❌ **None** |
   | Choose a license | ❌ **None** |

3. Clic en **Create repository**

### 4.2 Subir el código

GitHub te mostrará una página con comandos. **Ignórala** y usa estos:

```bash
git init
git add .
git commit -m "Sistema POS Abarrotes La Esquina"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/pos-abarrotes.git
git push -u origin main
```

> 🔁 Reemplaza `TU_USUARIO` por tu nombre de usuario de GitHub.

### 4.3 Autenticación

Si te pide usuario y contraseña:

- **Username:** tu usuario de GitHub
- **Password:** ⚠️ **NO** es tu contraseña normal. Necesitas un **token**:
  1. Ve a [github.com/settings/tokens](https://github.com/settings/tokens)
  2. **Generate new token** → **Generate new token (classic)**
  3. Note: `pos-deploy`
  4. Expiration: `90 days`
  5. Marca la casilla ✅ **repo**
  6. Clic en **Generate token**
  7. **Copia el token** (solo se muestra una vez) y pégalo como contraseña

### 4.4 Verificar

Recarga la página de tu repositorio en GitHub. Debes ver todos los archivos.

> ✅ **Comprueba que NO aparezca el archivo `.env`** — está protegido por `.gitignore`.

---

## PASO 5 · Desplegar en Vercel

### 5.1 Importar el repositorio

1. Entra a **[vercel.com/new](https://vercel.com/new)**
2. Si es tu primera vez: **Continue with GitHub** → autoriza el acceso
3. Busca `pos-abarrotes` en la lista
4. Clic en **Import**

### 5.2 Configurar el proyecto

Vercel detecta Next.js automáticamente. **No cambies nada** excepto:

Despliega la sección **Environment Variables** y agrega:

| Key | Value |
|---|---|
| `DATABASE_URL` | Pega tu cadena de Neon completa |

Clic en **Add**.

### 5.3 Desplegar

Clic en el botón **Deploy**.

Espera 2–3 minutos. Verás el progreso del build.

### 5.4 ¡Listo!

Cuando termine verás confetti 🎉 y tu URL:

```
https://pos-abarrotes.vercel.app
```

Clic en **Visit** para abrirla.

---

## PASO 6 · Verificación final

Comprueba que todo funcione:

- [ ] Abre la URL de Vercel
- [ ] Inicia sesión con `admin@pos.com` / `admin123`
- [ ] Entra a **Punto de Venta**
- [ ] Clic en **Escanear** → acepta el permiso de cámara
- [ ] Agrega un producto y haz una venta de prueba
- [ ] Verifica que el ticket se genere

---

## 📱 Instalar en el celular

1. Abre la URL de Vercel en **Chrome** (Android) o **Safari** (iPhone)
2. Menú **⋮** o **Compartir**
3. Selecciona **"Añadir a pantalla de inicio"**
4. Ya tienes la app instalada como aplicación nativa

> 📷 La cámara funciona porque Vercel provee HTTPS automáticamente.

---

## 🔄 Actualizar el proyecto después

Cada vez que cambies algo:

```bash
git add .
git commit -m "Descripción del cambio"
git push
```

Vercel **redespliega automáticamente** en ~2 minutos.

---

## 🔧 Solución de problemas

<details>
<summary><b>❌ Error: "DATABASE_URL is not defined" en Vercel</b></summary>

1. Ve a tu proyecto en Vercel
2. **Settings** → **Environment Variables**
3. Verifica que `DATABASE_URL` exista y tenga el valor correcto
4. Ve a **Deployments** → menú `···` del último → **Redeploy**
</details>

<details>
<summary><b>❌ El build falla en Vercel</b></summary>

Prueba compilar localmente para ver el error real:

```bash
npm run build
```

Corrige el error, luego:
```bash
git add .
git commit -m "Fix build"
git push
```
</details>

<details>
<summary><b>❌ La cámara no abre en el celular</b></summary>

- Verifica que la URL empiece con **`https://`**
- Revisa los permisos del navegador:
  - **Chrome Android:** Ajustes → Configuración del sitio → Cámara
  - **iPhone:** Ajustes → Safari → Cámara → Permitir
- Prueba en modo incógnito
</details>

<details>
<summary><b>❌ "remote origin already exists"</b></summary>

```bash
git remote remove origin
git remote add origin https://github.com/TU_USUARIO/pos-abarrotes.git
git push -u origin main
```
</details>

<details>
<summary><b>❌ Los datos desaparecen al cambiar de dispositivo</b></summary>

Es el comportamiento actual: los datos se guardan en `localStorage` del navegador.

Para sincronizar entre dispositivos hay que migrar la lógica a la base de datos PostgreSQL (el esquema ya está listo en `src/db/schema.ts`).
</details>

---

## 🔐 Seguridad para producción real

Antes de usar el sistema con datos reales:

1. **Cambia las contraseñas** en `/users` desde la aplicación
2. **Repositorio privado** en GitHub
3. **Nunca subas el `.env`** (ya está protegido)
4. Si expones el token de GitHub por error, revócalo en [Settings → Tokens](https://github.com/settings/tokens)

---

## 📊 Resumen de comandos

```bash
# Instalación inicial
npm install

# Crear tablas en la base de datos
npm run db:push

# Desarrollo local
npm run dev

# Compilar para producción
npm run build

# Ver la base de datos visualmente
npm run db:studio

# Subir cambios a producción
git add .
git commit -m "mensaje"
git push
```
