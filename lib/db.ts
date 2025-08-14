import { PrismaClient } from '@prisma/client';

/**
 * Database connection utility using Prisma.
 *
 * - Ensures a single PrismaClient instance is reused during development to avoid
 *   exhausting database connections due to hot-reloading (HMR).
 * - Exports the Prisma client and some small helpers to run transactions and
 *   gracefully disconnect.
 *
 * Usage:
 *   import db from '~/lib/db';
 *   await db.user.findMany();
 */

/**
 * Extend the global object to hold a cached PrismaClient instance in development.
 * This prevents creating multiple instances when the Next.js server reloads.
 */
declare global {
  // eslint-disable-next-line no-var
  var __prismaClient?: PrismaClient;
}

// Configure Prisma logging in development for easier debugging.
const isDevelopment = process.env.NODE_ENV !== 'production';

const prisma = global.__prismaClient ??
  new PrismaClient({
    log: isDevelopment ? ['query', 'warn', 'error'] : ['warn', 'error'],
  });

// Cache the client in the global variable in development to support HMR.
if (isDevelopment) {
  global.__prismaClient = prisma;
}

/**
 * Default export: PrismaClient instance.
 *
 * Use this in your API routes or server components to access the database.
 */
export default prisma;

/**
 * getPrisma
 * Simple accessor for the Prisma client (useful for testing or DI).
 */
export function getPrisma(): PrismaClient {
  return prisma;
}

/**
 * runTransaction
 * Helper to run multiple operations in a single transaction.
 *
 * Example:
 *   await runTransaction(async (tx) => {
 *     const user = await tx.user.create({ data: { ... } });
 *     await tx.order.create({ data: { userId: user.id, ... } });
 *   });
 */
export async function runTransaction<T>(
  callback: (tx: PrismaClient) => Promise<T>,
  opts?: { maxWait?: number; timeout?: number } // forwarded to $transaction
): Promise<T> {
  // Prisma $transaction can accept an async callback which receives a transactional client.
  return prisma.$transaction(callback as any, opts);
}

/**
 * disconnectPrisma
 * Gracefully disconnects the Prisma client. Useful in test teardown or scripts.
 */
export async function disconnectPrisma(): Promise<void> {
  try {
    await prisma.$disconnect();
    if (isDevelopment) {
      // clear cached instance so tests or scripts can reload a fresh client if needed
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      delete global.__prismaClient;
    }
  } catch (error) {
    // swallow disconnect errors but log for debugging
    // eslint-disable-next-line no-console
    console.warn('Prisma disconnect error:', error);
  }
}