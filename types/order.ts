import type { Product } from './product';
import type { User } from './user';

/**
 * Order lifecycle statuses
 */
export type OrderStatus =
  | 'pending' // order created but not yet processed
  | 'processing' // payment received and order is being prepared
  | 'shipped' // order has shipped
  | 'delivered' // order delivered to customer
  | 'cancelled' // order cancelled before fulfillment
  | 'refunded'; // order refunded after delivery/cancellation

/**
 * Shipping address associated with an order
 */
export interface ShippingAddress {
  fullName: string;
  address1: string;
  address2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  phone?: string;
  // Optional instructions like "leave at doorstep"
  instructions?: string;
}

/**
 * Payment result details returned by payment providers (PayPal, Stripe, etc.)
 */
export interface PaymentResult {
  provider?: 'stripe' | 'paypal' | 'shopify' | 'manual' | string;
  transactionId?: string;
  status?: string;
  amount?: number;
  currency?: string;
  paidAt?: string; // ISO date-time
  receiptUrl?: string;
  // Raw provider response for debugging / reconciliation (kept optional)
  raw?: unknown;
}

/**
 * Individual item within an order
 */
export interface OrderItem {
  // reference to product id (string to remain DB-agnostic)
  productId: string;
  // optional populated product object (present when joined/populated)
  product?: Product;
  name: string;
  image?: string;
  quantity: number;
  price: number; // price per unit, in order currency smallest unit or decimal
  // Optional product variant info (size, color, etc.)
  variant?: Record<string, string>;
  sku?: string;
}

/**
 * Main Order interface stored in DB and used across the app
 */
export interface Order {
  // optional id field (databases or API may use _id / id)
  id?: string;
  // the user who placed the order (guest orders might omit userId)
  userId?: string;
  // optional populated user object (when joined)
  user?: User;
  items: OrderItem[];
  shippingAddress: ShippingAddress;
  paymentMethod: string; // e.g. 'stripe', 'paypal', 'card', 'cash'
  paymentResult?: PaymentResult;
  itemsPrice: number; // subtotal of items
  shippingPrice: number;
  taxPrice: number;
  totalPrice: number;
  currency?: string; // ISO currency code, e.g. 'USD'
  isPaid: boolean;
  paidAt?: string; // ISO date-time
  isDelivered: boolean;
  deliveredAt?: string; // ISO date-time
  status: OrderStatus;
  notes?: string; // customer or admin notes
  createdAt?: string; // ISO date-time
  updatedAt?: string; // ISO date-time
  // Free-form metadata useful for integrations
  metadata?: Record<string, unknown>;
}

/**
 * DTO for creating an order from client
 */
export interface CreateOrderInput {
  userId?: string; // optional for guest checkout
  items: {
    productId: string;
    name: string;
    image?: string;
    quantity: number;
    price: number;
    variant?: Record<string, string>;
    sku?: string;
  }[];
  shippingAddress: ShippingAddress;
  paymentMethod: string;
  itemsPrice: number;
  shippingPrice: number;
  taxPrice: number;
  totalPrice: number;
  currency?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

/**
 * DTO for updating order status (admin or fulfillment systems)
 */
export interface UpdateOrderStatusInput {
  orderId: string;
  status: OrderStatus;
  isPaid?: boolean;
  paidAt?: string;
  isDelivered?: boolean;
  deliveredAt?: string;
  trackingNumber?: string;
  shippingCarrier?: string;
  notes?: string;
}

/**
 * DTO for marking an order as paid by a payment provider
 */
export interface PayOrderInput {
  orderId: string;
  paymentResult: PaymentResult;
}

/**
 * Query/filter options for fetching lists of orders (server-side)
 */
export interface OrderQuery {
  userId?: string;
  status?: OrderStatus | OrderStatus[];
  isPaid?: boolean;
  isDelivered?: boolean;
  fromDate?: string; // ISO date
  toDate?: string; // ISO date
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'totalPrice';
  sortDir?: 'asc' | 'desc';
}

/**
 * Utility: Default order status for newly created orders
 */
export const DEFAULT_ORDER_STATUS: OrderStatus = 'pending';

/**
 * Calculate totals for an order from items plus shipping and tax.
 * Uses simple arithmetic and returns values rounded to 2 decimals.
 */
export function calculateOrderTotals(
  items: Pick<OrderItem, 'quantity' | 'price'>[],
  shippingPrice = 0,
  taxPrice = 0
) {
  const itemsPriceRaw = items.reduce((sum, it) => sum + it.price * it.quantity, 0);
  const itemsPrice = roundToTwo(itemsPriceRaw);
  const shipping = roundToTwo(shippingPrice);
  const tax = roundToTwo(taxPrice);
  const totalPrice = roundToTwo(itemsPrice + shipping + tax);
  return { itemsPrice, shippingPrice: shipping, taxPrice: tax, totalPrice };
}

/** Helper: round number to 2 decimal places (handles floating point issues) */
function roundToTwo(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}