// components/Cart.tsx
"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import type { Product } from "../types/product";
import { useRouter } from "next/navigation";

interface CartItem extends Product {
  quantity: number;
}

interface CartProps {
  initialItems?: CartItem[];
  onCheckoutSuccess?: (order: any) => void;
  className?: string;
}

const STORAGE_KEY = "cart_v1";

/**
 * Utility to format numbers as currency.
 */
const formatCurrency = (value: number, locale = "en-US", currency = "USD") =>
  new Intl.NumberFormat(locale, { style: "currency", currency }).format(value);

/**
 * Helper to get numeric price from product which may have price as number or object
 */
function getPriceValue(p: Product | CartItem): number {
  const pr = (p as any).price;
  if (pr === undefined || pr === null) return 0;
  if (typeof pr === "number") return pr;
  if (typeof pr === "object" && typeof pr.value === "number") return pr.value;
  return 0;
}

/**
 * Shopping Cart component
 *
 * - Persists cart to localStorage
 * - Allows changing quantities, removing items, clearing cart
 * - Performs checkout via POST /api/orders
 */
export default function Cart({ initialItems = [], onCheckoutSuccess, className = "" }: CartProps) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();

  // Load from localStorage on mount (or use initialItems if provided)
  useEffect(() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const parsed: CartItem[] = JSON.parse(raw);
        setItems(parsed);
      } else if (initialItems.length) {
        setItems(initialItems);
      }
    } catch (err) {
      // If localStorage parse fails, fallback to initialItems or empty
      setItems(initialItems);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist items to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      // ignore
    }
  }, [items]);

  const saveAndNotify = (nextItems: CartItem[]) => {
    setItems(nextItems);
    setMessage(null);
  };

  const addItem = (product: Product, qty = 1) => {
    setItems((prev) => {
      const foundIndex = prev.findIndex((p) => p.id === product.id);
      if (foundIndex !== -1) {
        const next = [...prev];
        next[foundIndex] = { ...next[foundIndex], quantity: next[foundIndex].quantity + qty };
        return next;
      }
      return [...prev, { ...product, quantity: qty }];
    });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    setItems((prev) => {
      if (quantity <= 0) {
        return prev.filter((p) => p.id !== productId);
      }
      return prev.map((p) => (p.id === productId ? { ...p, quantity } : p));
    });
  };

  const removeItem = (productId: string) => {
    setItems((prev) => prev.filter((p) => p.id !== productId));
  };

  const clearCart = () => {
    setItems([]);
    setMessage({ type: "success", text: "Cart cleared." });
  };

  const subtotal = items.reduce((acc, it) => acc + getPriceValue(it) * it.quantity, 0);
  const taxRate = 0.08; // example tax
  const tax = subtotal * taxRate;
  const shipping = items.length > 0 ? 4.99 : 0;
  const total = subtotal + tax + shipping;

  const handleCheckout = async () => {
    if (items.length === 0) {
      setMessage({ type: "error", text: "Your cart is empty." });
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      const payload = {
        items: items.map((i) => ({
          productId: i.id,
          name: i.name,
          price: getPriceValue(i),
          quantity: i.quantity,
        })),
        meta: {
          subtotal,
          tax,
          shipping,
          total,
        },
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.message || `Failed to create order (${res.status})`);
      }

      const data = await res.json();

      // Clear cart on success
      setItems([]);
      setMessage({ type: "success", text: "Order placed successfully." });

      // Callback for parent if needed
      if (onCheckoutSuccess) onCheckoutSuccess(data);

      // Optionally redirect to order page if order id present
      if (data?.id) {
        // useRouter from next/navigation works in client components
        router.push(`/orders/${data.id}`);
      }
    } catch (error: any) {
      console.error("Checkout error:", error);
      setMessage({ type: "error", text: error?.message || "Checkout failed. Please try again." });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <aside className={`w-full max-w-3xl mx-auto p-4 bg-white rounded shadow ${className}`}>
      <header className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Shopping Cart</h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={clearCart}
            className="text-sm text-red-600 hover:underline disabled:text-gray-400"
            disabled={items.length === 0}
            aria-disabled={items.length === 0}
            type="button"
          >
            Clear
          </button>
        </div>
      </header>

      {message && (
        <div
          role="status"
          className={`mb-4 p-2 rounded text-sm ${message.type === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}
        >
          {message.text}
        </div>
      )}

      {items.length === 0 ? (
        <div className="py-12 text-center text-gray-500">
          <p>Your cart is empty.</p>
          <p className="mt-2 text-sm">Add items to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <ul className="divide-y">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-4 py-4">
                <div className="w-20 h-20 relative flex-shrink-0 rounded overflow-hidden bg-gray-100">
                  {item.image ? (
                    <Image src={item.image} alt={item.name} fill sizes="80px" className="object-cover" />
                  ) : item.images && item.images.length ? (
                    <Image src={item.images[0].url} alt={item.images[0].alt ?? item.name} fill sizes="80px" className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <h3 className="text-sm font-medium text-gray-900">{item.name}</h3>
                    <div className="text-sm text-gray-700">{formatCurrency(getPriceValue(item))}</div>
                  </div>

                  <p className="mt-1 text-xs text-gray-500 line-clamp-2">{item.description ?? ""}</p>

                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center border rounded text-sm overflow-hidden">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="px-3 py-1 hover:bg-gray-100 disabled:opacity-50"
                        aria-label={`Decrease quantity of ${item.name}`}
                        disabled={item.quantity <= 1}
                        type="button"
                      >
                        −
                      </button>
                      <div className="px-3 py-1 bg-white w-12 text-center">{item.quantity}</div>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="px-3 py-1 hover:bg-gray-100"
                        aria-label={`Increase quantity of ${item.name}`}
                        type="button"
                      >
                        +
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(getPriceValue(item) * item.quantity)}
                      </div>
                      <button
                        onClick={() => removeItem(item.id)}
                        className="text-sm text-red-600 hover:underline"
                        type="button"
                        aria-label={`Remove ${item.name}`}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <div className="border-t pt-4">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600 mt-1">
              <span>Tax (est.)</span>
              <span>{formatCurrency(tax)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-600 mt-1">
              <span>Shipping</span>
              <span>{shipping > 0 ? formatCurrency(shipping) : "Free"}</span>
            </div>

            <div className="flex items-center justify-between mt-4">
              <div>
                <div className="text-sm text-gray-500">Total</div>
                <div className="text-xl font-semibold">{formatCurrency(total)}</div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCheckout}
                  disabled={isLoading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-60"
                  type="button"
                >
                  {isLoading ? "Processing..." : "Checkout"}
                </button>

                <button
                  onClick={() => {
                    // Quick action: save cart snapshot to localStorage (already saved)
                    setMessage({ type: "success", text: "Cart saved." });
                  }}
                  className="px-3 py-2 border rounded text-sm"
                  type="button"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}