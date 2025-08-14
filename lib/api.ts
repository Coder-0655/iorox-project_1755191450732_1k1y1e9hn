import type { Product } from "../types/product";
import type { User } from "../types/user";
import type { Order } from "../types/order";

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

export interface ApiRequestOptions {
  /** milliseconds until request aborts (default: 10000) */
  timeout?: number;
  /** Authorization token to send as Bearer token */
  token?: string;
  /** Additional headers to merge */
  headers?: Record<string, string>;
  /** If true, don't set Content-Type automatically (useful for FormData) */
  omitContentType?: boolean;
  /** query params to append to the URL */
  params?: Record<string, string | number | boolean | undefined | null>;
  /** fetch init overrides (cache, credentials, next, etc.) */
  fetchOptions?: RequestInit;
}

/**
 * Custom error returned when the API responds with non-2xx.
 * Contains parsed response body (if available) as `data`.
 */
export class ApiError extends Error {
  public status: number;
  public data: unknown | null;

  constructor(message: string, status = 500, data: unknown | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

/**
 * Default API base. For local API routes this should be '/api'.
 * You can override by setting NEXT_PUBLIC_API_BASE_URL at build/runtime.
 */
const DEFAULT_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";

/** Default timeout for requests (ms) */
const DEFAULT_TIMEOUT = 10000;

/** Safely parse body as JSON, fallback to text if JSON parsing fails. */
async function parseBody(response: Response): Promise<unknown> {
  const text = await response.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Build a URL with query parameters */
function buildUrl(base: string, path: string, params?: ApiRequestOptions["params"]) {
  // Ensure path does not contain double slashes when concatenating
  const normalizedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${normalizedBase}${normalizedPath}`, typeof window === "undefined" ? "http://localhost" : window.location.origin);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      url.searchParams.set(key, String(value));
    });
  }

  // If using absolute origin fallback above, strip origin for relative calls to server
  if (url.origin === "http://localhost" && normalizedBase.startsWith("/")) {
    return url.pathname + url.search;
  }

  return url.toString();
}

/** Perform a fetch with timeout and standardized error handling. */
async function request<T = unknown>(
  method: HttpMethod,
  path: string,
  body?: unknown,
  opts: ApiRequestOptions = {},
  baseUrl = DEFAULT_BASE
): Promise<T> {
  const {
    timeout = DEFAULT_TIMEOUT,
    token,
    headers = {},
    omitContentType = false,
    params,
    fetchOptions,
  } = opts;

  const url = buildUrl(baseUrl, path, params);

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  const requestHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers,
  };

  // Set content-type if body is present and not omitted (FormData should omit)
  if (body !== undefined && !omitContentType && !(body instanceof FormData)) {
    requestHeaders["Content-Type"] = "application/json";
  }

  if (token) {
    requestHeaders["Authorization"] = `Bearer ${token}`;
  }

  const init: RequestInit = {
    method,
    signal: controller.signal,
    headers: requestHeaders,
    ...fetchOptions,
  };

  if (body !== undefined) {
    init.body = body instanceof FormData ? body : JSON.stringify(body);
  }

  try {
    const res = await fetch(url, init);
    clearTimeout(id);

    if (!res.ok) {
      const data = await parseBody(res);
      throw new ApiError(res.statusText || "Request failed", res.status, data);
    }

    // No content
    if (res.status === 204) {
      return null as unknown as T;
    }

    const data = await parseBody(res);
    return data as T;
  } catch (err) {
    clearTimeout(id);
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError("Request timeout", 408, null);
    }
    // other network/fetch errors
    throw new ApiError((err as Error).message || "Network error", 0, null);
  }
}

/* ---------------------------
   Generic helper functions
   --------------------------- */

export async function apiGet<T = unknown>(path: string, opts?: ApiRequestOptions) {
  return request<T>("GET", path, undefined, opts);
}

export async function apiPost<T = unknown, B = unknown>(path: string, body?: B, opts?: ApiRequestOptions) {
  return request<T>("POST", path, body as unknown, opts);
}

export async function apiPut<T = unknown, B = unknown>(path: string, body?: B, opts?: ApiRequestOptions) {
  return request<T>("PUT", path, body as unknown, opts);
}

export async function apiDelete<T = unknown>(path: string, opts?: ApiRequestOptions) {
  return request<T>("DELETE", path, undefined, opts);
}

/* ---------------------------
   High-level API functions
   These target the application's API routes:
   - /api/products
   - /api/users
   - /api/orders
   --------------------------- */

const PRODUCTS_PATH = "/products";
const USERS_PATH = "/users";
const ORDERS_PATH = "/orders";

/* Products */
export async function getProducts(params?: ApiRequestOptions["params"], opts?: ApiRequestOptions) {
  return apiGet<Product[]>(PRODUCTS_PATH, { ...opts, params });
}

export async function getProductById(id: string, opts?: ApiRequestOptions) {
  return apiGet<Product>(`${PRODUCTS_PATH}/${encodeURIComponent(id)}`, opts);
}

export async function createProduct(product: Partial<Product>, opts?: ApiRequestOptions) {
  return apiPost<Product>(PRODUCTS_PATH, product, opts);
}

export async function updateProduct(id: string, product: Partial<Product>, opts?: ApiRequestOptions) {
  return apiPut<Product>(`${PRODUCTS_PATH}/${encodeURIComponent(id)}`, product, opts);
}

export async function deleteProduct(id: string, opts?: ApiRequestOptions) {
  return apiDelete<void>(`${PRODUCTS_PATH}/${encodeURIComponent(id)}`, opts);
}

/* Users */
export async function getUsers(params?: ApiRequestOptions["params"], opts?: ApiRequestOptions) {
  return apiGet<User[]>(USERS_PATH, { ...opts, params });
}

export async function getUserById(id: string, opts?: ApiRequestOptions) {
  return apiGet<User>(`${USERS_PATH}/${encodeURIComponent(id)}`, opts);
}

export async function createUser(user: Partial<User>, opts?: ApiRequestOptions) {
  return apiPost<User>(USERS_PATH, user, opts);
}

export async function updateUser(id: string, user: Partial<User>, opts?: ApiRequestOptions) {
  return apiPut<User>(`${USERS_PATH}/${encodeURIComponent(id)}`, user, opts);
}

export async function deleteUser(id: string, opts?: ApiRequestOptions) {
  return apiDelete<void>(`${USERS_PATH}/${encodeURIComponent(id)}`, opts);
}

/* Orders */
export async function getOrders(params?: ApiRequestOptions["params"], opts?: ApiRequestOptions) {
  return apiGet<Order[]>(ORDERS_PATH, { ...opts, params });
}

export async function getOrderById(id: string, opts?: ApiRequestOptions) {
  return apiGet<Order>(`${ORDERS_PATH}/${encodeURIComponent(id)}`, opts);
}

export async function createOrder(order: Partial<Order>, opts?: ApiRequestOptions) {
  return apiPost<Order>(ORDERS_PATH, order, opts);
}

/* Authentication helpers (common patterns) */
export async function login(email: string, password: string) {
  // expects backend to return { token, user }
  return apiPost<{ token: string; user: User }>("/auth/login", { email, password }, { timeout: 15000 });
}

export async function register(user: Partial<User>) {
  return apiPost<{ token: string; user: User }>("/auth/register", user, { timeout: 15000 });
}

/* Convenience default export */
const api = {
  apiGet,
  apiPost,
  apiPut,
  apiDelete,
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  getOrders,
  getOrderById,
  createOrder,
  login,
  register,
  ApiError,
};

export default api;