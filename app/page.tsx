// app/page.tsx
import React from "react";
import ProductCard from "../components/ProductCard";
import Cart from "../components/Cart";
import { Product } from "../types/product";

type HomePageProps = {};

// Server component: fetch products from internal API and render the client explorer
export default async function HomePage(_: HomePageProps) {
  // Prefer using a relative fetch in server components so Next routes are resolved server-side.
  // `base` is optional and left blank for local relative fetch.
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  const res = await fetch(`${base}/api/products`, { cache: "no-store" });
  const json = await res.json().catch(() => null);

  // API returns either an array or an object with `data` property -> normalize to Product[]
  const products: Product[] = Array.isArray(json)
    ? (json as Product[])
    : (json && (json.data as Product[])) || [];

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-extrabold text-gray-900">
              Welcome to NextCommerce
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Curated collection of products. Fast, modern, and easy to use.
            </p>
          </div>
          <div>
            {/* Cart component is a client component; rendering here is fine */}
            <Cart />
          </div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        {/* Product explorer (client-side interactive) */}
        <ProductExplorer initialProducts={products} />
      </section>
    </main>
  );
}

/* ---------- Client-side interactive product explorer ---------- */
/* This inner component is a client component so it can be interactive.
   It handles search, filtering, sorting, pagination, and a lightweight client cart.
*/
type ProductExplorerProps = {
  initialProducts: Product[];
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export function ProductExplorer({ initialProducts }: ProductExplorerProps) {
  "use client";

  const { useEffect, useMemo, useState } = React;

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [sort, setSort] = useState<string>("featured");
  const [page, setPage] = useState<number>(1);
  const pageSize = 12;

  // Simple cart state local to the page (many apps use context; this keeps it self-contained).
  const [cartItems, setCartItems] = useState<
    { product: Product; quantity: number }[]
  >([]);

  // Helper to extract numeric price from either number or Price object
  const getPriceValue = (p: Product) => {
    const pr = (p as any).price;
    if (pr === undefined || pr === null) return 0;
    if (typeof pr === "number") return pr;
    if (typeof pr === "object" && typeof pr.value === "number") return pr.value;
    return 0;
  };

  // Derive categories from initial products
  const categories = useMemo(() => {
    const set = new Set<string>();
    initialProducts.forEach((p) => {
      const cat = Array.isArray(p.category) ? p.category[0] : (p.category as string | undefined);
      if (cat) set.add(cat);
    });
    return ["all", ...Array.from(set)];
  }, [initialProducts]);

  // Filtering and sorting
  const filtered = useMemo(() => {
    let list = initialProducts.slice();

    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((p) => {
        const title = (p.title ?? p.name ?? "").toString().toLowerCase();
        const desc = (p.description ?? "").toString().toLowerCase();
        return title.includes(q) || desc.includes(q);
      });
    }

    if (category !== "all") {
      list = list.filter((p) =>
        Array.isArray(p.category) ? p.category.includes(category) : p.category === category
      );
    }

    switch (sort) {
      case "price-asc":
        list.sort((a, b) => getPriceValue(a) - getPriceValue(b));
        break;
      case "price-desc":
        list.sort((a, b) => getPriceValue(b) - getPriceValue(a));
        break;
      case "newest":
        // assume createdAt exists as ISO string
        list.sort((a, b) => {
          const da = a.createdAt ? Date.parse(a.createdAt) : 0;
          const db = b.createdAt ? Date.parse(b.createdAt) : 0;
          return db - da;
        });
        break;
      default:
        // featured or fallback: keep the server order
        break;
    }

    return list;
  }, [initialProducts, query, category, sort]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  // Cart helpers
  const addToCart = (product: Product, qty = 1) => {
    setCartItems((prev) => {
      const idx = prev.findIndex((i) => i.product.id === product.id);
      if (idx >= 0) {
        const copy = prev.slice();
        copy[idx] = {
          ...copy[idx],
          quantity: copy[idx].quantity + qty,
        };
        return copy;
      }
      return [...prev, { product, quantity: qty }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCartItems((prev) => prev.filter((i) => i.product.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    setCartItems((prev) =>
      prev.map((i) => (i.product.id === productId ? { ...i, quantity } : i))
    );
  };

  const clearCart = () => setCartItems([]);

  const cartTotal = useMemo(
    () =>
      cartItems.reduce(
        (sum, item) => sum + (getPriceValue(item.product) ?? 0) * item.quantity,
        0
      ),
    [cartItems]
  );

  return (
    <div className="space-y-8">
      {/* Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex-1">
          <label htmlFor="search" className="sr-only">
            Search products
          </label>
          <div className="relative">
            <input
              id="search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products, descriptions..."
              className="w-full rounded-md border border-gray-200 bg-white py-2 px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-md border border-gray-200 bg-white py-2 px-3 text-sm focus:outline-none"
            aria-label="Filter by category"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c === "all" ? "All categories" : c}
              </option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-md border border-gray-200 bg-white py-2 px-3 text-sm focus:outline-none"
            aria-label="Sort products"
          >
            <option value="featured">Featured</option>
            <option value="newest">Newest</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
          </select>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Product grid (3 columns when wide) */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-gray-600">
              Showing <span className="font-medium">{filtered.length}</span> products
            </div>
            <div className="text-sm text-gray-500">
              Page {page} of {totalPages}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {paginated.length === 0 ? (
              <div className="col-span-full rounded-md border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
                No products found — try adjusting your search or filters.
              </div>
            ) : (
              paginated.map((p) => (
                <div key={p.id} className="w-full">
                  {/* We use the shared ProductCard component for consistent UI.
                      It is expected to accept a `product` prop. */}
                  <ProductCard product={p} />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-gray-900">
                      {formatCurrency(getPriceValue(p))}
                    </div>
                    <div>
                      <button
                        onClick={() => addToCart(p, 1)}
                        className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        Add to cart
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Pagination controls */}
          <nav
            className="mt-8 flex items-center justify-between"
            aria-label="Pagination"
          >
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-md border border-gray-200 bg-white px-3 py-1 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-md border border-gray-200 bg-white px-3 py-1 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>

            <div className="text-sm text-gray-500">
              Showing {(page - 1) * pageSize + 1} -{" "}
              {Math.min(page * pageSize, filtered.length)} of {filtered.length}
            </div>
          </nav>
        </div>

        {/* Sidebar: simple cart summary */}
        <aside className="lg:col-span-1">
          <div className="sticky top-24 space-y-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h3 className="text-sm font-medium text-gray-900">Cart</h3>
              <p className="mt-1 text-sm text-gray-500">
                Quick view of items in your cart.
              </p>

              <div className="mt-4 space-y-3">
                {cartItems.length === 0 ? (
                  <div className="text-sm text-gray-500">Your cart is empty</div>
                ) : (
                  cartItems.map((item) => (
                    <div
                      key={item.product.id}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        {item.product.image ? (
                          // product.image may be a string or an array; render if string
                          typeof item.product.image === "string" ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.product.image}
                              alt={item.product.title ?? item.product.name}
                              className="h-10 w-10 rounded-md object-cover"
                            />
                          ) : null
                        ) : item.product.images && item.product.images.length ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.product.images[0].url}
                            alt={item.product.images[0].alt ?? item.product.name}
                            className="h-10 w-10 rounded-md object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-md bg-gray-100" />
                        )}
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">
                            {item.product.title ?? item.product.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {item.quantity} × {formatCurrency(getPriceValue(item.product))}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) =>
                            updateQuantity(item.product.id, Math.max(1, Number(e.target.value) || 1))
                          }
                          className="w-16 rounded-md border border-gray-200 py-1 px-2 text-sm"
                        />
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="text-sm text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-4 border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">{formatCurrency(cartTotal)}</span>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => {
                      // Placeholder checkout flow — in a real app you'd route to checkout page
                      alert("Proceeding to checkout (demo)");
                    }}
                    disabled={cartItems.length === 0}
                    className="flex-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Checkout
                  </button>
                  <button
                    onClick={clearCart}
                    disabled={cartItems.length === 0}
                    className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm disabled:opacity-50"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            {/* Example of embedding the shared Cart component (if it provides more advanced UI) */}
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <h4 className="text-sm font-medium text-gray-900">Full Cart</h4>
              <p className="mt-1 text-xs text-gray-500">
                Use the full cart for advanced interactions (if available).
              </p>
              <div className="mt-3">
                {/* Render the shared Cart component. We render it without props
                    to avoid assuming a specific API. If your Cart accepts props,
                    adapt the import/usage accordingly. */}
                <Cart />
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}