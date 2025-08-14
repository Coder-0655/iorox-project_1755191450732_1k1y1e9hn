// types/product.ts
/**
 * types/product.ts
 *
 * Type definitions for product data used across the application.
 *
 * Note:
 * - Historically some components in this project expect a simpler shape:
 *   - price as a number (e.g., 19.99)
 *   - a singular `image` string
 *   - `title` sometimes used interchangeably with `name`
 *   - `compareAt`, `reviewsCount`, and numeric `rating` fields
 *
 * To support both richer and lightweight shapes, the Product type below
 * accepts either the structured Price object or a simple numeric price,
 * and includes optional backward-compatible fields used by the UI.
 */

export type ProductID = string;

/**
 * Common currency codes. You can extend this enum or use plain strings in the Price type.
 */
export enum Currency {
  USD = "USD",
  EUR = "EUR",
  GBP = "GBP",
  CAD = "CAD",
  AUD = "AUD",
}

/**
 * Standard shape for price information (rich format).
 */
export interface Price {
  /**
   * Monetary value as a number (e.g., 19.99)
   */
  value: number;
  /**
   * ISO 4217 currency code (e.g., 'USD'). Prefer using Currency enum values.
   */
  currency: Currency | string;
  /**
   * Optional sale/discounted price. If present, frontend can show original vs sale price.
   */
  salePrice?: number;
  /**
   * Optional pre-formatted price string to display directly (localized).
   */
  formatted?: string;
}

/**
 * Image asset for product (primary images, thumbnails, variant images).
 */
export interface ProductImage {
  id?: string;
  url: string;
  alt?: string;
  width?: number;
  height?: number;
  /**
   * Ordering position for galleries
   */
  position?: number;
  /**
   * Arbitrary metadata for CDN transformations, focal point, etc.
   */
  metadata?: Record<string, any>;
}

/**
 * An option for a product variant (e.g., Color: Red).
 */
export interface VariantOption {
  name: string;
  value: string;
}

/**
 * Single variant of a product (combination of options like size/color).
 */
export interface ProductVariant {
  id: string;
  sku?: string;
  name?: string;
  /**
   * Options describing this variant (e.g., [{ name: 'Size', value: 'M' }])
   */
  options?: VariantOption[];
  price?: Price | number;
  images?: ProductImage[];
  /**
   * Number of items available for this variant.
   * Undefined usually means inventory is not tracked at variant-level.
   */
  stock?: number;
  metadata?: Record<string, any>;
}

/**
 * Physical dimensions for shipping/display purposes.
 */
export interface Dimensions {
  height?: number;
  width?: number;
  depth?: number;
  /**
   * Unit for dimensions. Default should be agreed upon in the application (e.g., 'cm').
   */
  unit?: "cm" | "in" | "mm" | "m";
}

/**
 * Rating summary for a product (rich form).
 */
export interface Rating {
  /**
   * Average rating value (e.g., 4.3)
   */
  average: number;
  /**
   * Total number of reviews
   */
  count: number;
  /**
   * Optional breakdown map, keyed by star value (1..5) to counts
   */
  breakdown?: Partial<Record<1 | 2 | 3 | 4 | 5, number>>;
}

/**
 * Primary product model used by the frontend and backend transfer objects.
 *
 * Note: To remain backwards-compatible with components that expect a simple
 * shape, several fields are provided as optional aliases (title, image,
 * numeric price, compareAt, reviewsCount, numeric rating).
 */
export interface Product {
  id: ProductID;

  /**
   * Canonical product name. Prefer using `name` in new code.
   */
  name: string;

  /**
   * Legacy / alternate title used in some UI pieces. If not present, consumers
   * can fallback to `name`.
   */
  title?: string;

  /**
   * URL-friendly unique identifier (slug)
   */
  slug?: string;

  /**
   * Full description in markdown/HTML/plain text
   */
  description?: string;

  /**
   * Short summary used in listings
   */
  shortDescription?: string;

  /**
   * Price can be a simple number (e.g. 19.99) or a richer Price object.
   */
  price?: number | Price;

  /**
   * Singular image URL (legacy/simple usage). Prefer `images` for galleries.
   */
  image?: string;

  /**
   * Image gallery. Use first image as primary if available.
   */
  images?: ProductImage[];

  /**
   * Thumbnails can be used for fast lists
   */
  thumbnails?: ProductImage[];

  /**
   * Comparison price (original price before discount). Numeric value expected by UI.
   */
  compareAt?: number;

  /**
   * Category path or id(s)
   */
  category?: string | string[];

  /**
   * Arbitrary tags (e.g., 'summer', 'bestseller')
   */
  tags?: string[];

  sku?: string;

  /**
   * Aggregate stock count for product (if variants exist, this can be sum or undefined)
   */
  stock?: number;

  /**
   * Threshold at which low-stock UX should trigger
   */
  lowStockThreshold?: number;

  variants?: ProductVariant[];

  /**
   * Generic attribute bag, keys map to attribute names (e.g., color -> ['red','blue'])
   */
  attributes?: Record<string, string | string[]>;

  dimensions?: Dimensions;

  /**
   * Weight useful for shipping calculations
   */
  weight?: {
    value: number;
    unit?: "kg" | "g" | "lb" | "oz";
  };

  /**
   * A simple numeric rating (average) kept for convenience in several UI components.
   * If the richer `rating` object is used, prefer `rating.average`.
   */
  rating?: number | Rating;

  /**
   * Convenience property used by list UIs
   */
  reviewsCount?: number;

  isFeatured?: boolean;

  /**
   * Product visibility flag
   */
  isActive?: boolean;

  /**
   * Miscellaneous metadata. Stored as JSON in DB.
   */
  metadata?: Record<string, any>;

  /**
   * ISO 8601 timestamps
   */
  createdAt?: string;
  updatedAt?: string;

  /**
   * Seller/merchant reference
   */
  vendorId?: string;
  vendorName?: string;
}

/**
 * Input shape used to create a product.
 * - id/createdAt/updatedAt are managed by the backend and omitted here.
 */
export type ProductCreateInput = Omit<Product, "id" | "createdAt" | "updatedAt">;

/**
 * Input shape used to update a product.
 * - Only partial fields allowed; id is required to identify the product.
 */
export type ProductUpdateInput = Partial<Omit<Product, "createdAt" | "updatedAt">> & {
  id: ProductID;
};

/**
 * Lightweight product projection used in lists or simplified endpoints.
 */
export interface ProductSummary {
  id: ProductID;
  name: string;
  slug?: string;
  price?: number | Price;
  thumbnails?: ProductImage[];
  rating?: number | Rating;
  isFeatured?: boolean;
  isActive?: boolean;
  tags?: string[];
}

/**
 * Generic paginated response for products
 */
export interface PaginatedProducts {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * Typical set of filters usable by product listing endpoints.
 */
export interface ProductFilters {
  query?: string;
  category?: string;
  tags?: string[];
  minPrice?: number;
  maxPrice?: number;
  /**
   * Only include products with available stock
   */
  inStock?: boolean;
  /**
   * Sorting options understood by the API/DB layer
   */
  sort?: "newest" | "price_asc" | "price_desc" | "popular" | "rating";
  page?: number;
  pageSize?: number;
}

/**
 * Generic API wrapper for responses.
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string | null;
}