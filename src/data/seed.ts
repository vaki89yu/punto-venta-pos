import { Product, Category, Customer, Supplier, User, StoreSettings } from "@/types";
import { fullProducts, mexicanCategories, mexicanSuppliers } from "./productsDatabase";

// Usar la base de datos completa de productos
export const demoCategories: Category[] = mexicanCategories;
export const demoProducts: Product[] = fullProducts;
export const demoSuppliers: Supplier[] = mexicanSuppliers;

// Clientes mejorados
export const demoCustomers: Customer[] = [
  { id: "cust-001", name: "María García López", phone: "5512345678", address: "Calle Principal #123, Col. Centro", rfc: "GALM800101ABC", totalSpent: 2845.50, totalPurchases: 45, lastPurchase: new Date(), isActive: true, createdAt: new Date() },
  { id: "cust-002", name: "José Martínez Hernández", phone: "5587654321", address: "Av. Revolución #456, Col. Centro", rfc: "MAHJ750202DEF", totalSpent: 1520.00, totalPurchases: 28, lastPurchase: new Date(), isActive: true, createdAt: new Date() },
  { id: "cust-003", name: "Guadalupe Sánchez Ruiz", phone: "5567890123", address: "Calle Hidalgo #789, Col. Centro", totalSpent: 3420.75, totalPurchases: 62, lastPurchase: new Date(), isActive: true, createdAt: new Date() },
  { id: "cust-004", name: "Francisco Rodríguez Pérez", phone: "5545678901", address: "Av. Juárez #321, Col. Centro", rfc: "ROPF800303GHI", totalSpent: 1890.00, totalPurchases: 35, lastPurchase: new Date(), isActive: true, createdAt: new Date() },
  { id: "cust-005", name: "Ana María López Torres", phone: "5534567890", address: "Calle Morelos #654, Col. Centro", totalSpent: 4250.25, totalPurchases: 78, lastPurchase: new Date(), isActive: true, createdAt: new Date() },
  { id: "cust-006", name: "Carlos Jiménez Flores", phone: "5523456789", address: "Av. Madero #987, Col. Centro", totalSpent: 980.00, totalPurchases: 18, lastPurchase: new Date(), isActive: true, createdAt: new Date() },
  { id: "cust-007", name: "Rosa Elena Castro Vega", phone: "5511122233", address: "Calle Allende #147, Col. Centro", totalSpent: 2150.50, totalPurchases: 42, lastPurchase: new Date(), isActive: true, createdAt: new Date() },
  { id: "cust-008", name: "Miguel Ángel Torres Díaz", phone: "5599988877", address: "Av. Insurgentes #258, Col. Centro", rfc: "TODM850404JKL", totalSpent: 3680.75, totalPurchases: 55, lastPurchase: new Date(), isActive: true, createdAt: new Date() },
  { id: "cust-009", name: "Carmen Morales Ortega", phone: "5577744433", address: "Calle Zaragoza #369, Col. Centro", totalSpent: 1420.00, totalPurchases: 26, lastPurchase: new Date(), isActive: true, createdAt: new Date() },
  { id: "cust-010", name: "Pedro Vázquez Mendoza", phone: "5566622211", address: "Av. Universidad #741, Col. Centro", totalSpent: 2750.25, totalPurchases: 48, lastPurchase: new Date(), isActive: true, createdAt: new Date() },
  { id: "cust-011", name: "Laura Patricia Cruz Santos", phone: "5555511111", address: "Calle Independencia #852, Col. Centro", totalSpent: 3250.00, totalPurchases: 58, lastPurchase: new Date(), isActive: true, createdAt: new Date() },
  { id: "cust-012", name: "Juan Carlos Ramírez Luna", phone: "5544422222", address: "Av. Hidalgo #963, Col. Centro", rfc: "RALJ700505MNO", totalSpent: 1890.50, totalPurchases: 32, lastPurchase: new Date(), isActive: true, createdAt: new Date() },
];

export const demoUsers: User[] = [
  { id: "user-1", name: "Administrador", email: "admin@pos.com", password: "admin123", role: "admin", isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: "user-2", name: "Gerente", email: "gerente@pos.com", password: "gerente123", role: "manager", isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: "user-3", name: "Cajero 1", email: "cajero@pos.com", password: "cajero123", role: "cashier", isActive: true, createdAt: new Date(), updatedAt: new Date() },
  { id: "user-4", name: "Cajero 2", email: "cajero2@pos.com", password: "cajero123", role: "cashier", isActive: true, createdAt: new Date(), updatedAt: new Date() },
];

export const demoStoreSettings: StoreSettings = {
  id: "settings-1",
  name: "Abarrotes La Esquina",
  address: "Calle Principal #123, Col. Centro, Ciudad de México",
  phone: "5512345678",
  email: "abarrotes@esquina.com",
  rfc: "ABE123456XYZ",
  taxRate: 16,
  currency: "MXN",
  ticketMessage: "¡Gracias por su compra! Vuelva pronto. ¡Dios le bendiga!",
  theme: "light",
};

// Claves de localStorage
export const STORAGE_KEYS = {
  PRODUCTS: "pos_products",
  CATEGORIES: "pos_categories",
  CUSTOMERS: "pos_customers",
  SUPPLIERS: "pos_suppliers",
  SALES: "pos_sales",
  USERS: "pos_users",
  SETTINGS: "pos_settings",
  CURRENT_USER: "pos_current_user",
  CASH_REGISTER: "pos_cash_register",
  CART: "pos_cart",
  CREDIT_SALES: "pos_credit_sales",
  APARTADOS: "pos_apartados",
  PROMOTIONS: "pos_promotions",
  RECIPES: "pos_recipes",
};

// Inicializar datos de demostración
export function initializeDemoData() {
  if (typeof window === "undefined") return;
  
  // Limpiar datos anteriores para actualizar
  if (!localStorage.getItem("pos_initialized_v2")) {
    localStorage.clear();
    localStorage.setItem("pos_initialized_v2", "true");
  }
  
  if (!localStorage.getItem(STORAGE_KEYS.PRODUCTS)) {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(demoProducts));
  }
  if (!localStorage.getItem(STORAGE_KEYS.CATEGORIES)) {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(demoCategories));
  }
  if (!localStorage.getItem(STORAGE_KEYS.CUSTOMERS)) {
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(demoCustomers));
  }
  if (!localStorage.getItem(STORAGE_KEYS.SUPPLIERS)) {
    localStorage.setItem(STORAGE_KEYS.SUPPLIERS, JSON.stringify(demoSuppliers));
  }
  if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(demoUsers));
  }
  if (!localStorage.getItem(STORAGE_KEYS.SETTINGS)) {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(demoStoreSettings));
  }
  
  // Inicializar arreglos vacíos para nuevas funcionalidades
  if (!localStorage.getItem(STORAGE_KEYS.CREDIT_SALES)) {
    localStorage.setItem(STORAGE_KEYS.CREDIT_SALES, JSON.stringify([]));
  }
  if (!localStorage.getItem(STORAGE_KEYS.APARTADOS)) {
    localStorage.setItem(STORAGE_KEYS.APARTADOS, JSON.stringify([]));
  }
  if (!localStorage.getItem(STORAGE_KEYS.PROMOTIONS)) {
    localStorage.setItem(STORAGE_KEYS.PROMOTIONS, JSON.stringify([]));
  }
  if (!localStorage.getItem(STORAGE_KEYS.RECIPES)) {
    localStorage.setItem(STORAGE_KEYS.RECIPES, JSON.stringify([]));
  }
}
