import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import * as dbModule from '../../../lib/db';
import type { User } from '../../../types/user';
import crypto from 'crypto';

/**
 * app/api/users/route.ts
 * API route to manage user accounts (GET, POST, PUT, DELETE)
 *
 * - Supports:
 *   GET  -> fetch all users or single user by id or email
 *   POST -> create a new user
 *   PUT  -> update user by id or email
 *   DELETE -> delete user by id or email
 *
 * The implementation tries to use the project's lib/db exports (prisma, default or helpers).
 * If unavailable, it falls back to an in-memory store (suitable for development).
 */

/* ----------------------------- Utilities ------------------------------ */

/**
 * Hash a password using SHA-256.
 * Using Node's crypto to avoid external dependencies (bcrypt) in this file.
 */
function hashPassword(password: string) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * Remove sensitive fields before returning user objects in responses.
 */
function sanitizeUser(user: any): Partial<User> {
  if (!user) return user;
  const { password, ...rest } = user;
  return rest;
}

/* ------------------------ Flexible DB Adapters ------------------------ */

/**
 * In-memory fallback store. Persists only for the lifetime of the Node.js process.
 * Useful when lib/db doesn't expose a usable API in this environment.
 */
const memoryStore = (() => {
  const map = new Map<string, any>();
  return {
    async getAll() {
      return Array.from(map.values());
    },
    async getById(id: string) {
      return map.get(id) ?? null;
    },
    async getByEmail(email: string) {
      for (const v of map.values()) {
        if (v.email === email) return v;
      }
      return null;
    },
    async create(data: any) {
      const id = data.id ?? crypto.randomUUID();
      const now = new Date().toISOString();
      const record = { id, ...data, createdAt: now, updatedAt: now };
      map.set(id, record);
      return record;
    },
    async updateById(id: string, updates: any) {
      const existing = map.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
      map.set(id, updated);
      return updated;
    },
    async deleteById(id: string) {
      const existed = map.get(id);
      if (!existed) return null;
      map.delete(id);
      return existed;
    },
  };
})();

/**
 * Tries to detect a usable DB interface in lib/db.
 * Supports:
 * - prisma client (dbModule.prisma) with prisma.user methods
 * - default exported helpers with getUser(s)/createUser/updateUser/deleteUser
 * - fallback to memoryStore
 */
function getDbAdapter() {
  // If prisma is exported
  if ((dbModule as any).prisma) {
    const prisma = (dbModule as any).prisma;
    return {
      async getAll() {
        return prisma.user.findMany();
      },
      async getById(id: string) {
        return prisma.user.findUnique({ where: { id } });
      },
      async getByEmail(email: string) {
        return prisma.user.findUnique({ where: { email } });
      },
      async create(data: any) {
        return prisma.user.create({ data });
      },
      async updateById(id: string, updates: any) {
        return prisma.user.update({ where: { id }, data: updates });
      },
      async deleteById(id: string) {
        return prisma.user.delete({ where: { id } });
      },
    };
  }

  // If module default export contains named helpers
  const def = (dbModule as any).default ?? dbModule;
  if (def) {
    // common helper names
    if (typeof def.getUsers === 'function' || typeof def.getUser === 'function') {
      return {
        async getAll() {
          if (typeof def.getUsers === 'function') return def.getUsers();
          if (typeof def.getAllUsers === 'function') return def.getAllUsers();
          return [];
        },
        async getById(id: string) {
          if (typeof def.getUserById === 'function') return def.getUserById(id);
          if (typeof def.getUser === 'function') return def.getUser({ id });
          return null;
        },
        async getByEmail(email: string) {
          if (typeof def.getUserByEmail === 'function') return def.getUserByEmail(email);
          if (typeof def.getUser === 'function') return def.getUser({ email });
          return null;
        },
        async create(data: any) {
          if (typeof def.createUser === 'function') return def.createUser(data);
          if (typeof def.insertUser === 'function') return def.insertUser(data);
          if (typeof def.create === 'function') return def.create('users', data);
          throw new Error('No create user function found on db module');
        },
        async updateById(id: string, updates: any) {
          if (typeof def.updateUser === 'function') return def.updateUser(id, updates);
          if (typeof def.update === 'function') return def.update('users', id, updates);
          throw new Error('No update user function found on db module');
        },
        async deleteById(id: string) {
          if (typeof def.deleteUser === 'function') return def.deleteUser(id);
          if (typeof def.delete === 'function') return def.delete('users', id);
          throw new Error('No delete user function found on db module');
        },
      };
    }
  }

  // Fallback
  return memoryStore;
}

/* ------------------------------ Handlers ----------------------------- */

const adapter = getDbAdapter();

/**
 * GET handler
 * - GET /api/users -> returns all users (password stripped)
 * - GET /api/users?id=... -> returns user by id
 * - GET /api/users?email=... -> returns user by email
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const email = url.searchParams.get('email');

    let result: any;

    if (id) {
      result = await adapter.getById(id);
      if (!result) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      return NextResponse.json(sanitizeUser(result));
    }

    if (email) {
      result = await adapter.getByEmail(email);
      if (!result) return NextResponse.json({ error: 'User not found' }, { status: 404 });
      return NextResponse.json(sanitizeUser(result));
    }

    const users = await adapter.getAll();
    const sanitized = Array.isArray(users) ? users.map(sanitizeUser) : [];
    return NextResponse.json(sanitized);
  } catch (err: any) {
    console.error('GET /api/users error', err);
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 });
  }
}

/**
 * POST handler - create a new user
 * Expected JSON body: { name?: string, email: string, password: string, role?: string }
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<User> & { password?: string };
    if (!body || !body.email || !body.password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    // Prevent duplicate emails
    const existing = await adapter.getByEmail(body.email);
    if (existing) {
      return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
    }

    const toCreate: any = {
      name: body.name ?? null,
      email: body.email,
      password: hashPassword(body.password),
      role: (body as any).role ?? 'user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const created = await adapter.create(toCreate);
    return NextResponse.json(sanitizeUser(created), { status: 201 });
  } catch (err: any) {
    console.error('POST /api/users error', err);
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 });
  }
}

/**
 * PUT handler - update an existing user
 * Query params: id or email required to identify the user.
 * Body: partial fields to update e.g. { name?: string, email?: string, password?: string, role?: string }
 */
export async function PUT(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const email = url.searchParams.get('email');

    if (!id && !email) {
      return NextResponse.json({ error: 'id or email query parameter is required' }, { status: 400 });
    }

    const updates = (await request.json()) as Partial<User> & { password?: string };

    // Find existing user
    const existing = id ? await adapter.getById(id) : await adapter.getByEmail(email!);
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const updatePayload: any = { ...updates };
    if (updates.password) updatePayload.password = hashPassword(updates.password);
    updatePayload.updatedAt = new Date().toISOString();

    // Prefer updateById using the resolved id
    const targetId = existing.id ?? id;
    if (!targetId) {
      return NextResponse.json({ error: 'Unable to determine user id' }, { status: 500 });
    }

    const updated = await adapter.updateById(targetId, updatePayload);
    return NextResponse.json(sanitizeUser(updated));
  } catch (err: any) {
    console.error('PUT /api/users error', err);
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 });
  }
}

/**
 * DELETE handler - delete a user
 * Query params: id or email required to identify the user.
 */
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const email = url.searchParams.get('email');

    if (!id && !email) {
      return NextResponse.json({ error: 'id or email query parameter is required' }, { status: 400 });
    }

    const existing = id ? await adapter.getById(id) : await adapter.getByEmail(email!);
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const targetId = existing.id ?? id;
    if (!targetId) {
      return NextResponse.json({ error: 'Unable to determine user id' }, { status: 500 });
    }

    const deleted = await adapter.deleteById(targetId);
    return NextResponse.json({ success: true, user: sanitizeUser(deleted) });
  } catch (err: any) {
    console.error('DELETE /api/users error', err);
    return NextResponse.json({ error: err?.message ?? 'Unknown error' }, { status: 500 });
  }
}