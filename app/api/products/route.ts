// app/api/products/route.ts
import { NextResponse } from "next/server";
import type { Product } from "../../../types/product";
import fs from "fs/promises";
import path from "path";

// Path for fallback file-based storage (used if no DB client is detected)
const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "products.json");

// Utility: basic slugify
const slugify = (str: string) =>
  str
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]+/g, "")
    .replace(/\-\-+/g, "-");

// Utility: ensure the fallback data file exists
async function ensureDataFile() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    try {
      await fs.access(DATA_FILE);
    } catch {
      // create initial file with empty array
      await fs.writeFile(DATA_FILE, JSON.stringify([]), "utf-8");
    }
  } catch (err) {
    // ignore — will be handled by callers
    console.error("Failed to ensure data file:", err);
  }
}

// Utility: read products from fallback file store
async function readProductsFromFile(): Promise<Product[]> {
  await ensureDataFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Product[];
    return [];
  } catch {
    return [];
  }
}

// Utility: write products to fallback file store
async function writeProductsToFile(products: Product[]) {
  await ensureDataFile();
  await fs.writeFile(DATA_FILE, JSON.stringify(products, null, 2), "utf-8");
}

// Validate product payload for POST
function validateProductPayload(body: any): { valid: true; value: Partial<Product> } | { valid: false; errors: string[] } {
  const errors: string[] = [];
  const value: Partial<Product> = {};

  if (!body || typeof body !== "object") {
    return { valid: false, errors: ["Invalid JSON payload"] };
  }

  const { name, price, description, image, stock, category, slug } = body;

  if (!name || typeof name !== "string" || name.trim().length < 1) {
    errors.push("name is required and must be a non-empty string");
  } else {
    value.name = name.trim();
  }

  if (price === undefined || price === null || isNaN(Number(price))) {
    errors.push("price is required and must be a number");
  } else {
    // allow numeric price or a Price-like object, but convert to a number for legacy compatibility
    const n = Number(price);
    value.price = n;
  }

  if (description && typeof description === "string") {
    value.description = description.trim();
  }

  if (image && typeof image === "string") {
    value.image = image.trim();
  }

  if (stock !== undefined) {
    const s = Number(stock);
    if (isNaN(s) || !Number.isFinite(s)) {
      errors.push("stock must be a number");
    } else {
      value.stock = s;
    }
  }

  if (category && typeof category === "string") {
    value.category = category.trim();
  }

  if (slug && typeof slug === "string") {
    value.slug = slugify(slug);
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, value };
}

// Attempt to dynamically import a DB client from lib/db and detect Prisma
async function tryGetPrisma() {
  try {
    // dynamic import to avoid build-time assumptions about exported names
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const dbModule = await import("../../../lib/db");
    // Common patterns: export prisma, default export prisma, export db.prisma, export default db
    // attempt to detect Prisma client (has .product methods or $queryRaw)
    const candidates = [
      (dbModule as any).prisma,
      (dbModule as any).default,
      (dbModule as any).db,
      dbModule,
    ];

    for (const candidate of candidates) {
      if (!candidate) continue;
      // detect typical prisma shape
      if (typeof candidate === "object" && ("product" in candidate || "$queryRaw" in candidate)) {
        return candidate;
      }
    }
  } catch (err) {
    // ignore — fallback to file store
  }
  return null;
}

// GET: list products with simple filtering/pagination
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const search = url.searchParams.get("q") || url.searchParams.get("search") || "";
    const category = url.searchParams.get("category") || undefined;
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 20)));
    const sort = (url.searchParams.get("sort") || "createdAt").toString();
    const order = (url.searchParams.get("order") || "desc").toString().toLowerCase();

    // Try to use Prisma if available
    const prisma = await tryGetPrisma();
    if (prisma) {
      // Build where clause
      const where: any = {};
      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { category: { contains: search, mode: "insensitive" } },
        ];
      }
      if (category) {
        where.category = category;
      }

      const orderBy: any = {};
      if (sort) {
        orderBy[sort] = order === "asc" ? "asc" : "desc";
      }

      const skip = (page - 1) * limit;

      const [items, total] = await Promise.all([
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        prisma.product.findMany({ where, skip, take: limit, orderBy }),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        prisma.product.count({ where }),
      ]);

      return NextResponse.json(
        { data: items, meta: { total, page, limit } },
        { status: 200 }
      );
    }

    // Fallback: file-based store
    const products = await readProductsFromFile();

    // Filtering
    let filtered = products;
    if (search) {
      const s = search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          (p.name && p.name.toLowerCase().includes(s)) ||
          (p.description && p.description.toLowerCase().includes(s)) ||
          (typeof p.category === "string" && p.category.toLowerCase().includes(s)) ||
          (Array.isArray(p.category) && p.category.join(" ").toLowerCase().includes(s))
      );
    }
    if (category) {
      filtered = filtered.filter((p) => (Array.isArray(p.category) ? p.category.includes(category) : p.category === category));
    }

    // Sorting
    filtered.sort((a: any, b: any) => {
      const aVal = (a as any)[sort];
      const bVal = (b as any)[sort];
      if (aVal === undefined && bVal === undefined) return 0;
      if (aVal === undefined) return order === "asc" ? -1 : 1;
      if (bVal === undefined) return order === "asc" ? 1 : -1;

      if (typeof aVal === "string" && typeof bVal === "string") {
        return order === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      if (aVal instanceof Date || bVal instanceof Date) {
        const aTime = new Date(aVal).getTime();
        const bTime = new Date(bVal).getTime();
        return order === "asc" ? aTime - bTime : bTime - aTime;
      }
      return order === "asc" ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
    });

    const total = filtered.length;
    const start = (page - 1) * limit;
    const paged = filtered.slice(start, start + limit);

    return NextResponse.json({ data: paged, meta: { total, page, limit } }, { status: 200 });
  } catch (err) {
    console.error("GET /api/products error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST: create a new product
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const validation = validateProductPayload(body);

    if (!validation.valid) {
      return NextResponse.json({ errors: validation.errors }, { status: 400 });
    }

    const payload = validation.value;

    // Build new product
    const now = new Date().toISOString();
    const newProduct: Product = {
      id: (globalThis as any).crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: payload.name!,
      description: payload.description ?? "",
      price: payload.price ?? 0,
      image: payload.image ?? null,
      stock: payload.stock ?? 0,
      category: payload.category ?? "uncategorized",
      slug: payload.slug ?? slugify(payload.name!),
      createdAt: now,
      updatedAt: now,
    } as Product;

    // Try to use Prisma if available
    const prisma = await tryGetPrisma();
    if (prisma) {
      // create using prisma
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      const created = await prisma.product.create({
        data: {
          id: newProduct.id,
          name: newProduct.name,
          description: newProduct.description,
          price: typeof newProduct.price === "object" ? (newProduct.price as any).value : newProduct.price,
          image: newProduct.image,
          stock: newProduct.stock,
          category: newProduct.category,
          slug: newProduct.slug,
          createdAt: newProduct.createdAt,
          updatedAt: newProduct.updatedAt,
        },
      });
      return NextResponse.json({ data: created }, { status: 201 });
    }

    // Fallback to file store
    const products = await readProductsFromFile();
    products.unshift(newProduct); // add to beginning to simulate newest first
    await writeProductsToFile(products);

    return NextResponse.json({ data: newProduct }, { status: 201 });
  } catch (err) {
    console.error("POST /api/products error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}