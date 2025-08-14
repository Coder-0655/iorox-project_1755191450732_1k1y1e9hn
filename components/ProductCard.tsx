// components/ProductCard.tsx
"use client";

import React, { useCallback, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Product } from "../types/product";

interface ProductCardProps {
  product: Product;
  /**
   * Optional callback when adding product to cart.
   * If omitted, component will fall back to a localStorage-based cart.
   */
  onAddToCart?: (product: Product, quantity: number) => Promise<void> | void;
  /**
   * Whether to show product description on the card
   */
  showDescription?: boolean;
  /**
   * Additional container classes
   */
  className?: string;
  /**
   * If true, mark Image priority for Next.js optimization
   */
  priorityImage?: boolean;
}

/**
 * Reusable product card for listing pages and grids.
 * - Interactive: add to cart, quantity selector, wishlist toggle
 * - Accessible: proper aria attributes
 * - Works with an optional onAddToCart prop; otherwise uses localStorage fallback
 */
const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddToCart,
  showDescription = true,
  className = "",
  priorityImage = false,
}) => {
  const [quantity, setQuantity] = useState<number>(1);
  const [isFavorite, setIsFavorite] = useState<boolean>(false);
  const [isAdding, setIsAdding] = useState<boolean>(false);

  const priceFormatter = useCallback((value: number) => {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(value);
  }, []);

  const truncate = useCallback((text: string, max = 120) => {
    if (!text) return "";
    return text.length > max ? text.slice(0, max).trimEnd() + "…" : text;
  }, []);

  const toggleFavorite = useCallback(() => {
    setIsFavorite((v) => !v);
    try {
      const key = "favorites";
      const raw = localStorage.getItem(key);
      const list: string[] = raw ? JSON.parse(raw) : [];
      if (!isFavorite) {
        // add
        if (!list.includes(product.id)) {
          list.push(product.id);
        }
      } else {
        // remove
        const idx = list.indexOf(product.id);
        if (idx >= 0) list.splice(idx, 1);
      }
      localStorage.setItem(key, JSON.stringify(list));
    } catch {
      // ignore localStorage errors silently
    }
  }, [isFavorite, product.id]);

  const saveToLocalCart = useCallback((prod: Product, qty: number) => {
    try {
      const key = "cart";
      const raw = localStorage.getItem(key);
      const cart: { id: string; quantity: number; product: Product }[] = raw
        ? JSON.parse(raw)
        : [];
      const existing = cart.find((c) => c.id === prod.id);
      if (existing) {
        existing.quantity = Math.min(
          (existing.quantity || 0) + qty,
          prod.stock ?? Number.MAX_SAFE_INTEGER
        );
      } else {
        cart.push({
          id: prod.id,
          quantity: Math.min(qty, prod.stock ?? qty),
          product: prod,
        });
      }
      localStorage.setItem(key, JSON.stringify(cart));
    } catch {
      // ignore errors
    }
  }, []);

  const handleAddToCart = useCallback(
    async (e?: React.MouseEvent) => {
      if (e) e.preventDefault();
      // guard quantity
      const qty = Math.max(1, Math.floor(quantity));
      if (product.stock !== undefined && qty > product.stock) {
        // if trying to add more than stock, clamp
        // simple client-side feedback via alert (avoid extra deps)
        alert("Requested quantity exceeds available stock.");
        return;
      }

      setIsAdding(true);
      try {
        if (onAddToCart) {
          await onAddToCart(product, qty);
        } else {
          // fallback to localStorage cart
          saveToLocalCart(product, qty);
        }
        // optimistic UI: reset quantity to 1
        setQuantity(1);
      } catch (err) {
        console.error("Failed to add to cart", err);
        // lightweight feedback
        alert("Could not add product to cart. Please try again.");
      } finally {
        setIsAdding(false);
      }
    },
    [quantity, onAddToCart, product, saveToLocalCart]
  );

  const handleQuantityChange = useCallback(
    (delta: number) => {
      setQuantity((q) => {
        const next = q + delta;
        if (next < 1) return 1;
        if (product.stock !== undefined && next > product.stock)
          return product.stock;
        return next;
      });
    },
    [product.stock]
  );

  // Helper: resolve numeric price value when product.price might be a number or Price object
  const getPriceValue = useCallback((p: Product) => {
    const pr = (p as any).price;
    if (pr === undefined || pr === null) return 0;
    if (typeof pr === "number") return pr;
    if (typeof pr === "object" && typeof pr.value === "number") return pr.value;
    return 0;
  }, []);

  const ratingSafe = Number(
    typeof product.rating === "number"
      ? product.rating
      : (product.rating && typeof (product.rating as any).average === "number"
          ? (product.rating as any).average
          : 0)
  );
  const roundedRating = Math.round(ratingSafe * 10) / 10;

  // Resolve image source (legacy `image` string or first item in `images` array)
  const imageSrc =
    typeof product.image === "string"
      ? product.image
      : product.images && product.images.length
      ? product.images[0].url
      : null;

  return (
    <article
      className={`group relative flex flex-col bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden ${className}`}
      aria-labelledby={`product-${product.id}-title`}
    >
      <Link
        href={`/products/${product.id}`}
        className="block relative aspect-[4/3] w-full bg-gray-50"
        aria-label={`View details for ${product.name}`}
      >
        <div className="relative w-full h-full">
          {imageSrc ? (
            // Next Image with "fill" requires a positioned parent which we have
            <Image
              src={imageSrc}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 100vw, 33vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              priority={priorityImage}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <svg
                className="w-12 h-12"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5" />
                <path d="M8 14s1.5-2 4-2 4 2 4 2" strokeWidth="1.5" />
              </svg>
            </div>
          )}
        </div>
      </Link>

      <div className="p-4 flex-1 flex flex-col justify-between gap-4">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3
                id={`product-${product.id}-title`}
                className="text-sm font-semibold text-gray-900 truncate"
                title={product.name}
              >
                <Link href={`/products/${product.id}`} className="block">
                  {product.name}
                </Link>
              </h3>
              <p className="mt-1 text-xs text-gray-500">
                {/* show brand if available, else category */}
                {(product as any).brand ?? (Array.isArray(product.category) ? product.category[0] : product.category ?? "")}
              </p>
            </div>

            <button
              type="button"
              aria-pressed={isFavorite}
              onClick={(e) => {
                e.preventDefault();
                toggleFavorite();
              }}
              title={isFavorite ? "Remove from favorites" : "Add to favorites"}
              className="inline-flex items-center justify-center p-2 rounded-full text-pink-600 hover:bg-pink-50 focus:outline-none focus:ring-2 focus:ring-pink-200"
            >
              {isFavorite ? (
                <svg
                  className="w-5 h-5 fill-current"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M12 21s-7-4.35-9-7.05C1.56 11.1 2.24 6.98 6.1 5.28 8.17 4.3 10.45 5.08 12 6.6c1.55-1.52 3.83-2.3 5.9-1.32 3.86 1.7 4.54 5.82 3.1 8.67C19 16.65 12 21 12 21z" />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                >
                  <path d="M20.8 8.6c-.9-3.1-4.1-4.8-7.1-3.6-1.1.5-2 1.2-2.7 2C9 6.2 7.5 5.5 6 5.5 3.4 5.5 1.5 7.8 2 10.6c.4 2 1.9 3.7 3.6 5.1l6.4 5.2 6.4-5.2c1.7-1.4 3.2-3.1 3.6-5.1.1-.6.1-1.2 0-1.8z" strokeWidth="1.2" />
                </svg>
              )}
            </button>
          </div>

          {showDescription && product.description && (
            <p className="mt-3 text-sm text-gray-600">{truncate(product.description, 140)}</p>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-lg font-semibold text-gray-900">
                {priceFormatter(getPriceValue(product))}
              </p>
              {product.compareAt && product.compareAt > (typeof product.price === "number" ? product.price : (product.price && (product.price as any).value) ?? 0) && (
                <p className="text-sm text-gray-500 line-through">{priceFormatter(product.compareAt)}</p>
              )}
            </div>

            <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
              <div className="flex items-center" aria-hidden="true">
                {Array.from({ length: 5 }).map((_, i) => {
                  const filled = i + 1 <= Math.round(ratingSafe);
                  return (
                    <svg
                      key={i}
                      className={`w-4 h-4 ${filled ? "text-yellow-400" : "text-gray-300"}`}
                      viewBox="0 0 20 20"
                      fill={filled ? "currentColor" : "none"}
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.49 6.91l6.561-.955L10 0l2.949 5.955 6.561.955-4.755 4.635 1.123 6.545z" />
                    </svg>
                  );
                })}
              </div>
              <span className="sr-only">{roundedRating} out of 5 stars</span>
              <span>{roundedRating}</span>
              {typeof product.reviewsCount === "number" && (
                <span className="text-xs text-gray-400">· {product.reviewsCount} reviews</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center border rounded-md overflow-hidden">
              <button
                type="button"
                onClick={() => handleQuantityChange(-1)}
                className="px-2 py-1 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                aria-label="Decrease quantity"
                disabled={quantity <= 1}
              >
                −
              </button>
              <div className="px-3 text-sm font-medium text-gray-800">{quantity}</div>
              <button
                type="button"
                onClick={() => handleQuantityChange(1)}
                className="px-2 py-1 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                aria-label="Increase quantity"
                disabled={product.stock !== undefined && quantity >= product.stock}
              >
                +
              </button>
            </div>

            <button
              type="button"
              onClick={handleAddToCart}
              disabled={isAdding || (product.stock !== undefined && product.stock <= 0)}
              className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-50"
            >
              {isAdding ? (
                <svg
                  className="w-4 h-4 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                </svg>
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M3 3h2l.4 2M7 13h10l4-8H5.4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="10" cy="20" r="1" />
                  <circle cx="18" cy="20" r="1" />
                </svg>
              )}
              <span>{product.stock === 0 ? "Sold out" : "Add"}</span>
            </button>
          </div>
        </div>

        {product.stock !== undefined && (
          <p className="mt-3 text-xs text-gray-500">
            {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
          </p>
        )}
      </div>
    </article>
  );
};

export default ProductCard;