import dotenv from "dotenv";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

dotenv.config({ path: [".env.local", ".env"] });

const databaseUrl = process.env.DATABASE_URL;
const adminEmail = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
const adminName = process.env.INITIAL_ADMIN_NAME?.trim() || "Administrador";
const storeName = process.env.STORE_NAME?.trim() || "Mi Tienda";

if (!databaseUrl) throw new Error("Falta DATABASE_URL. Configura PostgreSQL antes de inicializar.");
if (!adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) throw new Error("Define INITIAL_ADMIN_EMAIL con un correo válido.");
if (!adminPassword || adminPassword.length < 14) throw new Error("INITIAL_ADMIN_PASSWORD debe tener al menos 14 caracteres.");
if (adminPassword.toLowerCase().includes("password") || adminPassword.toLowerCase().includes("admin123")) throw new Error("Elige una contraseña inicial que no sea una contraseña de ejemplo.");

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: /neon\.tech|supabase|sslmode=require/i.test(databaseUrl) ? { rejectUnauthorized: false } : undefined,
  max: 1,
  connectionTimeoutMillis: 10000,
});

try {
  await pool.query("select 1");
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const result = await pool.query(
    `insert into users (name, email, password, role, is_active)
     values ($1, $2, $3, 'admin', true)
     on conflict (email) do nothing
     returning id`,
    [adminName, adminEmail, passwordHash]
  );
  if (result.rowCount) {
    console.log(`Cuenta administradora creada: ${adminEmail}`);
  } else {
    console.log(`La cuenta ${adminEmail} ya existe; no se modificó su contraseña ni su rol.`);
  }

  await pool.query(
    `insert into categories (name, description, color)
     select $1, 'Categoría inicial del catálogo propio', '#2563EB'
     where not exists (select 1 from categories where lower(name) = lower($1))`,
    ["General"]
  );
  await pool.query(
    `insert into store_settings (name)
     select $1
     where not exists (select 1 from store_settings)`,
    [storeName]
  );
  console.log("Base de datos preparada: usuario administrador, categoría General y configuración inicial.");
  console.log("No se insertaron productos, clientes ni ventas ficticias.");
} finally {
  await pool.end();
}
