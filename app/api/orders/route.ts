import { NextResponse } from "next/server";
import prisma from "../../../lib/db";
import type { Order as OrderType } from "../../../types/order";

/**
 * API route: /api/orders
 * Methods:
 *  - GET:  Return a list of orders (most recent first), including user and items
 *  - POST: Create a new order with items
 *
 * NOTE: This implementation assumes a Prisma-style client exported as default from lib/db
 * and a schema with models similar to: Order, OrderItem, Product, User.
 *
 * The code performs basic validation of the POST payload and returns detailed error responses.
 */

/* ----------------------------- Helper Types ------------------------------ */

interface OrderItemRequest {
  productId: string;
  quantity: number;
  // optional snapshot price to record price at time of order
  price?: number;
}

interface CreateOrderRequest {
  userId: string;
  items: OrderItemRequest[];
  shipping?: {
    name?: string;
    address?: string;
    city?: string;
    postalCode?: string;
    country?: string;
    phone?: string;
  };
  paymentMethod?: string;
  total: number;
}

/* --------------------------- Utility Functions --------------------------- */

/**
 * Simple validator for CreateOrderRequest
 * Throws an Error with a message describing the validation problem.
 */
function validateOrderPayload(payload: unknown): CreateOrderRequest {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Payload must be a JSON object.");
  }

  const p = payload as Record<string, unknown>;

  if (!p.userId || typeof p.userId !== "string") {
    throw new Error("Missing or invalid 'userId'.");
  }

  if (!Array.isArray(p.items) || p.items.length === 0) {
    throw new Error("'items' must be a non-empty array.");
  }

  const items: OrderItemRequest[] = p.items.map((it, idx) => {
    if (typeof it !== "object" || it === null) {
      throw new Error(`Item at index ${idx} must be an object.`);
    }
    const item = it as Record<string, unknown>;

    if (!item.productId || typeof item.productId !== "string") {
      throw new Error(`Missing or invalid 'productId' for item at index ${idx}.`);
    }
    if (
      typeof item.quantity !== "number" ||
      !Number.isFinite(item.quantity) ||
      item.quantity <= 0 ||
      Math.floor(item.quantity) !== item.quantity
    ) {
      throw new Error(`Missing or invalid 'quantity' for item at index ${idx}. Must be a positive integer.`);
    }

    const price =
      item.price === undefined ? undefined : typeof item.price === "number" && Number.isFinite(item.price) ? item.price : (() => { throw new Error(`Invalid 'price' for item at index ${idx}.`); })();

    return {
      productId: item.productId,
      quantity: item.quantity,
      price,
    };
  });

  if (typeof p.total !== "number" || !Number.isFinite(p.total) || p.total < 0) {
    throw new Error("Missing or invalid 'total'. Must be a non-negative number.");
  }

  const shipping = p.shipping && typeof p.shipping === "object" ? (p.shipping as CreateOrderRequest["shipping"]) : undefined;
  const paymentMethod = p.paymentMethod && typeof p.paymentMethod === "string" ? p.paymentMethod : undefined;

  return {
    userId: p.userId,
    items,
    shipping,
    paymentMethod,
    total: p.total,
  };
}

/* ------------------------------- GET Handler ----------------------------- */

/**
 * GET /api/orders
 * Returns a list of orders with related items and user info.
 */
export async function GET() {
  try {
    // Fetch orders, include items and product snapshots if available, and user reference
    // This query assumes Prisma models with relations: Order -> items -> product, and Order -> user
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: {
            product: true, // include product snapshot if schema allows
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Cast to the application's OrderType if appropriate
    const result: Partial<OrderType>[] = orders;

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (err: unknown) {
    // If prisma.order does not exist or another error occurs, return a server error with message
    const message = err instanceof Error ? err.message : "Unknown error while fetching orders.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/* ------------------------------- POST Handler ---------------------------- */

/**
 * POST /api/orders
 * Create a new order with the provided items and metadata.
 *
 * Expected payload:
 * {
 *   userId: string,
 *   items: [{ productId: string, quantity: number, price?: number }],
 *   shipping?: { ... },
 *   paymentMethod?: string,
 *   total: number
 * }
 */
export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const data = validateOrderPayload(payload);

    // Basic existence checks: ensure user exists and products exist with sufficient stock if applicable.
    // This implementation performs optimistic checks and uses a DB transaction.
    const user = await prisma.user.findUnique({ where: { id: data.userId } });
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found." }, { status: 404 });
    }

    // Fetch all involved products
    const productIds = Array.from(new Set(data.items.map((i) => i.productId)));
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, price: true, stock: true, name: true },
    });

    const productsById = new Map(products.map((p) => [p.id, p]));

    // Validate each item references an existing product and has sufficient stock (if stock is tracked)
    for (const item of data.items) {
      const prod = productsById.get(item.productId);
      if (!prod) {
        return NextResponse.json(
          { success: false, error: `Product not found: ${item.productId}` },
          { status: 404 }
        );
      }
      if (typeof prod.stock === "number") {
        if (prod.stock < item.quantity) {
          return NextResponse.json(
            { success: false, error: `Insufficient stock for product ${prod.name} (${prod.id}). Requested ${item.quantity}, available ${prod.stock}.` },
            { status: 400 }
          );
        }
      }
    }

    // Create order and order items in a transaction
    const createdOrder = await prisma.$transaction(async (tx) => {
      // Create order record
      const order = await tx.order.create({
        data: {
          userId: data.userId,
          total: data.total,
          status: "pending",
          paymentMethod: data.paymentMethod ?? null,
          shipping: data.shipping ?? null,
          // If your schema has fields like tax, shippingPrice, etc. add them here
        },
      });

      // Create related order items and optionally decrement product stock
      for (const item of data.items) {
        const prod = productsById.get(item.productId)!;
        // Create orderItem; this assumes an OrderItem model with orderId, productId, quantity, price
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: item.productId,
            quantity: item.quantity,
            price: item.price ?? prod.price ?? 0,
          },
        });

        // If product has stock tracked as a numeric field, decrement it
        if (typeof prod.stock === "number") {
          await tx.product.update({
            where: { id: prod.id },
            data: { stock: { decrement: item.quantity } as any }, // cast to any for Prisma-compatible update
          });
        }
      }

      // Return the created order with its items and user
      const fullOrder = await tx.order.findUnique({
        where: { id: order.id },
        include: {
          items: {
            include: { product: true },
          },
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return fullOrder;
    });

    return NextResponse.json({ success: true, data: createdOrder }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error while creating order.";
    // Validation errors should return 400
    if (message && message.toLowerCase().includes("missing") || message.toLowerCase().includes("invalid")) {
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}