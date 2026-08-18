import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const userRoleEnum = pgEnum("user_role", ["admin", "manager", "cashier", "inventory"]);
export const saleStatusEnum = pgEnum("sale_status", ["completed", "cancelled", "refunded", "pending"]);
export const paymentMethodEnum = pgEnum("payment_method", ["cash", "card", "transfer", "mixed", "qr"]);
export const inventoryMovementTypeEnum = pgEnum("inventory_movement_type", ["in", "out", "adjustment", "sale", "return"]);
export const cashRegisterStatusEnum = pgEnum("cash_register_status", ["open", "closed"]);
export const returnStatusEnum = pgEnum("return_status", ["pending", "approved", "rejected"]);
export const themeEnum = pgEnum("theme", ["light", "dark", "system"]);

// Users Table
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  role: userRoleEnum("role").notNull().default("cashier"),
  avatar: text("avatar"),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Categories Table
export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 7 }).notNull().default("#3B82F6"),
  icon: varchar("icon", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Suppliers Table
export const suppliers = pgTable("suppliers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  company: varchar("company", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 255 }),
  address: text("address"),
  balance: decimal("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Products Table
export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  sku: varchar("sku", { length: 100 }).notNull().unique(),
  barcode: varchar("barcode", { length: 100 }).notNull(),
  categoryId: uuid("category_id").references(() => categories.id),
  brand: varchar("brand", { length: 100 }),
  image: text("image"),
  purchasePrice: decimal("purchase_price", { precision: 12, scale: 2 }).notNull(),
  salePrice: decimal("sale_price", { precision: 12, scale: 2 }).notNull(),
  discountPrice: decimal("discount_price", { precision: 12, scale: 2 }),
  stock: integer("stock").notNull().default(0),
  minStock: integer("min_stock").notNull().default(5),
  unit: varchar("unit", { length: 50 }).notNull().default("pieza"),
  supplierId: uuid("supplier_id").references(() => suppliers.id),
  tax: decimal("tax", { precision: 5, scale: 2 }).notNull().default("16"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Customers Table
export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 255 }),
  address: text("address"),
  rfc: varchar("rfc", { length: 13 }),
  totalSpent: decimal("total_spent", { precision: 12, scale: 2 }).notNull().default("0"),
  totalPurchases: integer("total_purchases").notNull().default(0),
  lastPurchase: timestamp("last_purchase"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Sales Table
export const sales = pgTable("sales", {
  id: uuid("id").defaultRandom().primaryKey(),
  ticketNumber: varchar("ticket_number", { length: 50 }).notNull().unique(),
  customerId: uuid("customer_id").references(() => customers.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 12, scale: 2 }).notNull().default("0"),
  tax: decimal("tax", { precision: 12, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  paymentDetails: jsonb("payment_details").$type<{ method: string; amount: number; reference?: string }[]>(),
  cashReceived: decimal("cash_received", { precision: 12, scale: 2 }),
  change: decimal("change", { precision: 12, scale: 2 }),
  status: saleStatusEnum("status").notNull().default("completed"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Sale Items Table
export const saleItems = pgTable("sale_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  saleId: uuid("sale_id").notNull().references(() => sales.id, { onDelete: "cascade" }),
  productId: uuid("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").notNull(),
  price: decimal("price", { precision: 12, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 12, scale: 2 }).notNull().default("0"),
  tax: decimal("tax", { precision: 12, scale: 2 }).notNull().default("0"),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).notNull(),
  total: decimal("total", { precision: 12, scale: 2 }).notNull(),
});

// Inventory Movements Table
export const inventoryMovements = pgTable("inventory_movements", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id").notNull().references(() => products.id),
  type: inventoryMovementTypeEnum("type").notNull(),
  quantity: integer("quantity").notNull(),
  previousStock: integer("previous_stock").notNull(),
  newStock: integer("new_stock").notNull(),
  reason: text("reason"),
  saleId: uuid("sale_id").references(() => sales.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Cash Registers Table
export const cashRegisters = pgTable("cash_registers", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id),
  openingAmount: decimal("opening_amount", { precision: 12, scale: 2 }).notNull(),
  closingAmount: decimal("closing_amount", { precision: 12, scale: 2 }),
  cashSales: decimal("cash_sales", { precision: 12, scale: 2 }).notNull().default("0"),
  cardSales: decimal("card_sales", { precision: 12, scale: 2 }).notNull().default("0"),
  transferSales: decimal("transfer_sales", { precision: 12, scale: 2 }).notNull().default("0"),
  cashIn: decimal("cash_in", { precision: 12, scale: 2 }).notNull().default("0"),
  cashOut: decimal("cash_out", { precision: 12, scale: 2 }).notNull().default("0"),
  expectedAmount: decimal("expected_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  difference: decimal("difference", { precision: 12, scale: 2 }),
  openedAt: timestamp("opened_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
  status: cashRegisterStatusEnum("status").notNull().default("open"),
});

// Cash Movements Table
export const cashMovements = pgTable("cash_movements", {
  id: uuid("id").defaultRandom().primaryKey(),
  cashRegisterId: uuid("cash_register_id").notNull().references(() => cashRegisters.id),
  type: varchar("type", { length: 10 }).notNull(), // 'in' or 'out'
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  userId: uuid("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Returns Table
export const returns = pgTable("returns", {
  id: uuid("id").defaultRandom().primaryKey(),
  saleId: uuid("sale_id").notNull().references(() => sales.id),
  totalRefund: decimal("total_refund", { precision: 12, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  status: returnStatusEnum("status").notNull().default("pending"),
  processedBy: uuid("processed_by").references(() => users.id),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Return Items Table
export const returnItems = pgTable("return_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  returnId: uuid("return_id").notNull().references(() => returns.id, { onDelete: "cascade" }),
  saleItemId: uuid("sale_item_id").notNull().references(() => saleItems.id),
  productId: uuid("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").notNull(),
  price: decimal("price", { precision: 12, scale: 2 }).notNull(),
  refundAmount: decimal("refund_amount", { precision: 12, scale: 2 }).notNull(),
});

// Store Settings Table
export const storeSettings = pgTable("store_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull().default("Mi Tienda"),
  logo: text("logo"),
  address: text("address"),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 255 }),
  rfc: varchar("rfc", { length: 13 }),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).notNull().default("16"),
  currency: varchar("currency", { length: 3 }).notNull().default("MXN"),
  ticketMessage: text("ticket_message"),
  theme: themeEnum("theme").notNull().default("system"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  sales: many(sales),
  cashRegisters: many(cashRegisters),
  inventoryMovements: many(inventoryMovements),
  cashMovements: many(cashMovements),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const suppliersRelations = relations(suppliers, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  supplier: one(suppliers, {
    fields: [products.supplierId],
    references: [suppliers.id],
  }),
  saleItems: many(saleItems),
  inventoryMovements: many(inventoryMovements),
}));

export const customersRelations = relations(customers, ({ many }) => ({
  sales: many(sales),
}));

export const salesRelations = relations(sales, ({ one, many }) => ({
  customer: one(customers, {
    fields: [sales.customerId],
    references: [customers.id],
  }),
  user: one(users, {
    fields: [sales.userId],
    references: [users.id],
  }),
  items: many(saleItems),
  inventoryMovements: many(inventoryMovements),
  returns: many(returns),
}));

export const saleItemsRelations = relations(saleItems, ({ one, many }) => ({
  sale: one(sales, {
    fields: [saleItems.saleId],
    references: [sales.id],
  }),
  product: one(products, {
    fields: [saleItems.productId],
    references: [products.id],
  }),
  returnItems: many(returnItems),
}));

export const inventoryMovementsRelations = relations(inventoryMovements, ({ one }) => ({
  product: one(products, {
    fields: [inventoryMovements.productId],
    references: [products.id],
  }),
  sale: one(sales, {
    fields: [inventoryMovements.saleId],
    references: [sales.id],
  }),
  user: one(users, {
    fields: [inventoryMovements.userId],
    references: [users.id],
  }),
}));

export const cashRegistersRelations = relations(cashRegisters, ({ one, many }) => ({
  user: one(users, {
    fields: [cashRegisters.userId],
    references: [users.id],
  }),
  cashMovements: many(cashMovements),
}));

export const cashMovementsRelations = relations(cashMovements, ({ one }) => ({
  cashRegister: one(cashRegisters, {
    fields: [cashMovements.cashRegisterId],
    references: [cashRegisters.id],
  }),
  user: one(users, {
    fields: [cashMovements.userId],
    references: [users.id],
  }),
}));

export const returnsRelations = relations(returns, ({ one, many }) => ({
  sale: one(sales, {
    fields: [returns.saleId],
    references: [sales.id],
  }),
  processedByUser: one(users, {
    fields: [returns.processedBy],
    references: [users.id],
  }),
  items: many(returnItems),
}));

export const returnItemsRelations = relations(returnItems, ({ one }) => ({
  return: one(returns, {
    fields: [returnItems.returnId],
    references: [returns.id],
  }),
  saleItem: one(saleItems, {
    fields: [returnItems.saleItemId],
    references: [saleItems.id],
  }),
  product: one(products, {
    fields: [returnItems.productId],
    references: [products.id],
  }),
}));
