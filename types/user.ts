/**
 * types/user.ts
 *
 * Type definitions for user-related data structures used across the application.
 * Designed for a full-stack eCommerce application (backend + frontend).
 *
 * - Uses strict typing for DTOs, DB models, and frontend-safe shapes.
 * - Keeps sensitive fields separated (SafeUser) so they are not accidentally sent to the client.
 */

import { Product } from './product';

/**
 * Possible roles a user can have in the platform.
 * - CUSTOMER: regular shopper
 * - SELLER: can list products
 * - ADMIN: manage the platform
 */
export enum UserRole {
  CUSTOMER = 'customer',
  SELLER = 'seller',
  ADMIN = 'admin',
}

/**
 * Account status flags.
 */
export enum UserStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  PENDING = 'pending', // e.g., awaiting email verification
}

/**
 * Address model for users.
 */
export interface Address {
  id: string;
  userId?: string; // optional when used as a nested DTO
  label?: string; // e.g., "Home", "Work"
  fullName?: string;
  street: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  phone?: string;
  isPrimary?: boolean;
  createdAt?: string; // ISO timestamp
  updatedAt?: string; // ISO timestamp
}

/**
 * Payment method representation (tokenized).
 * Card details should never include the full PAN.
 */
export interface PaymentMethod {
  id: string;
  userId?: string;
  provider: string; // e.g., "stripe", "paypal"
  token: string; // token/reference returned by the payment provider
  cardBrand?: string; // e.g., "visa", "mastercard"
  last4?: string;
  expMonth?: number;
  expYear?: number;
  isDefault?: boolean;
  billingAddressId?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Item in user's wishlist.
 * Reference product minimally to avoid heavy payloads.
 */
export interface WishlistItem {
  id: string;
  userId?: string;
  productId: string;
  addedAt?: string;
  // Optionally include a lightweight product preview
  productPreview?: Pick<Product, 'id' | 'title' | 'price' | 'images'>;
}

/**
 * Minimal cart item type used in user carts (server-side or persisted client-side).
 */
export interface CartItem {
  productId: string;
  quantity: number;
  selectedOptions?: Record<string, string>; // e.g., { size: 'M', color: 'red' }
  addedAt?: string;
}

/**
 * Complete User model as stored in the database.
 * Note: password and reset tokens exist here and must be excluded from client DTOs.
 */
export interface User {
  id: string;
  email: string;
  emailVerified?: boolean;
  password?: string; // hashed password; should never be exposed to clients
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;
  role: UserRole;
  status: UserStatus;
  bio?: string;
  addresses?: Address[];
  paymentMethods?: PaymentMethod[];
  wishlist?: WishlistItem[];
  cart?: CartItem[];
  metadata?: Record<string, unknown>; // arbitrary key/value store for extensibility
  // Security / password reset fields
  resetToken?: string | null;
  resetTokenExpiry?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * A client-safe representation of a user with sensitive fields removed.
 * Use this type for responses from server endpoints that are consumed by the browser.
 */
export type SafeUser = Omit<User, 'password' | 'resetToken' | 'resetTokenExpiry' | 'metadata'>;

/**
 * Authentication credential payload for login.
 */
export interface AuthCredentials {
  email: string;
  password: string;
  remember?: boolean; // whether to create a long-lived session
}

/**
 * Authentication response tokens.
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number; // seconds until access token expiry
  tokenType?: 'Bearer' | string;
  issuedAt?: string;
}

/**
 * Payload used to create a new user (registration).
 * Backend should validate required fields and enforce password rules.
 */
export interface UserCreateDTO {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: UserRole; // default should be UserRole.CUSTOMER on server
  addresses?: Address[];
}

/**
 * Fields allowed to be updated on a user profile.
 * Sensitive fields like role or status should be controlled by admin endpoints.
 */
export interface UserUpdateDTO {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatarUrl?: string;
  bio?: string;
  addresses?: Address[]; // full replacement; consider separate address endpoints
  paymentMethods?: PaymentMethod[]; // tokenized methods; managed carefully
}

/**
 * DTO for password reset requests and confirmations.
 */
export interface PasswordResetRequestDTO {
  email: string;
}

export interface PasswordResetConfirmDTO {
  token: string;
  newPassword: string;
}

/**
 * Standardized API response wrapping a single user object.
 */
export interface UserResponse<T = SafeUser> {
  success: boolean;
  data?: T;
  error?: string | null;
}

/**
 * Generic paginated response for listing users.
 */
export interface PaginatedUsers {
  items: SafeUser[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Query params when listing users in admin panels or API calls.
 */
export interface UserQueryParams {
  page?: number;
  pageSize?: number;
  q?: string; // search query (email, name)
  role?: UserRole;
  status?: UserStatus;
  sortBy?: 'createdAt' | 'email' | 'lastName' | 'firstName';
  sortDir?: 'asc' | 'desc';
}

/**
 * Utility type guard to determine if an object is a SafeUser.
 */
export function isSafeUser(obj: unknown): obj is SafeUser {
  if (!obj || typeof obj !== 'object') return false;
  const anyObj = obj as Record<string, unknown>;
  return typeof anyObj.id === 'string' && typeof anyObj.email === 'string';
}