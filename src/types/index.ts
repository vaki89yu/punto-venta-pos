export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: "admin" | "manager" | "cashier" | "inventory";
  avatar?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon?: string;
  createdAt: Date;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  sku: string;
  barcode: string;
  categoryId: string;
  category?: Category;
  brand?: string;
  image?: string;
  purchasePrice: number;
  salePrice: number;
  discountPrice?: number;
  stock: number;
  minStock: number;
  unit: string;
  supplierId?: string;
  supplier?: Supplier;
  tax: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  rfc?: string;
  totalSpent: number;
  totalPurchases: number;
  lastPurchase?: Date;
  isActive: boolean;
  createdAt: Date;
}

export interface Supplier {
  id: string;
  name: string;
  company: string;
  phone?: string;
  email?: string;
  address?: string;
  balance: number;
  isActive: boolean;
  createdAt: Date;
}

export interface SaleItem {
  id: string;
  saleId: string;
  productId: string;
  product?: Product;
  quantity: number;
  price: number;
  discount: number;
  tax: number;
  subtotal: number;
  total: number;
}

export interface Sale {
  id: string;
  ticketNumber: string;
  customerId?: string;
  customer?: Customer;
  userId: string;
  user?: User;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: PaymentMethod;
  paymentDetails: PaymentDetail[];
  cashReceived?: number;
  change?: number;
  status: "completed" | "cancelled" | "refunded" | "pending";
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentDetail {
  method: "cash" | "card" | "transfer" | "qr";
  amount: number;
  reference?: string;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  product?: Product;
  type: "in" | "out" | "adjustment" | "sale" | "return";
  quantity: number;
  previousStock: number;
  newStock: number;
  reason?: string;
  userId: string;
  user?: User;
  createdAt: Date;
}

export interface CashRegister {
  id: string;
  userId: string;
  user?: User;
  openingAmount: number;
  closingAmount?: number;
  cashSales: number;
  cardSales: number;
  transferSales: number;
  cashIn: number;
  cashOut: number;
  expectedAmount: number;
  difference?: number;
  openedAt: Date;
  closedAt?: Date;
  status: "open" | "closed";
}

export interface CashMovement {
  id: string;
  cashRegisterId: string;
  type: "in" | "out";
  amount: number;
  reason: string;
  userId: string;
  user?: User;
  createdAt: Date;
}

export interface Return {
  id: string;
  saleId: string;
  sale?: Sale;
  items: ReturnItem[];
  totalRefund: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
  processedBy: string;
  processedAt?: Date;
  createdAt: Date;
}

export interface ReturnItem {
  id: string;
  returnId: string;
  saleItemId: string;
  productId: string;
  product?: Product;
  quantity: number;
  price: number;
  refundAmount: number;
}

export interface StoreSettings {
  id: string;
  name: string;
  logo?: string;
  address?: string;
  phone?: string;
  email?: string;
  rfc?: string;
  taxRate: number;
  currency: string;
  ticketMessage?: string;
  theme: "light" | "dark" | "system";
}

export interface CartItem {
  product: Product;
  quantity: number;
  discount: number;
}

export type SaleStatus = "completed" | "cancelled" | "refunded" | "pending";
export type PaymentMethod = "cash" | "card" | "transfer" | "mixed" | "qr";
export type UserRole = "admin" | "manager" | "cashier" | "inventory";
export type InventoryMovementType = "in" | "out" | "adjustment" | "sale" | "return";
