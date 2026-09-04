// KROWN POS — Next.js Middleware
// Runs on every request. Handles JWT verification, tenant context, rate limiting.

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET environment variable is required in production');
    }
    console.warn('⚠ JWT_SECRET not set — using dev fallback. Set JWT_SECRET in production!');
    return new TextEncoder().encode('krown-dev-secret-change-in-production');
  }
  return new TextEncoder().encode(secret);
})();

// Public routes that don't require auth
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/pin-login',
  '/api/super-admin/login',
  '/api/auth/refresh',
  '/api/health',
  '/_next',
  '/favicon.ico',
  '/manifest.json',
  '/icon.svg',
  '/sw.js',
];

// Rate limiting store (in-memory, production should use Redis)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) {
    return false;
  }

  entry.count++;
  return true;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for public/static routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Skip middleware for non-API routes (client-side handles its own auth)
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Rate limiting
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const rateLimitKey = `api:${ip}`;
  if (!checkRateLimit(rateLimitKey, 100, 60000)) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  // Auth endpoints have stricter rate limiting
  if (pathname.startsWith('/api/auth/')) {
    const authKey = `auth:${ip}`;
    if (!checkRateLimit(authKey, 5, 60000)) {
      return NextResponse.json({ error: 'Too many login attempts' }, { status: 429 });
    }
  }

  // Extract token from Authorization header or cookie
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') || request.cookies.get('krown_session')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    // Verify JWT
    const { payload } = await jwtVerify(token, JWT_SECRET);

    // Extract tenant context
    const orgId = payload.org as string;
    const userId = payload.sub as string;
    const role = payload.role as string;
    const branchId = payload.branch as string | null;

    if (!orgId || !userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Check if Super Admin route
    if (pathname.startsWith('/api/super-admin/')) {
      if (role !== 'super_admin') {
        return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
      }
    }

    // Add tenant context to request headers for downstream use
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-org-id', orgId);
    requestHeaders.set('x-user-id', userId);
    requestHeaders.set('x-user-role', role);
    if (branchId) {
      requestHeaders.set('x-branch-id', branchId);
    }

    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  } catch (err: any) {
    if (err.code === 'ERR_JWT_EXPIRED') {
      return NextResponse.json({ error: 'Token expired' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}

export const config = {
  matcher: ['/api/:path*'],
};
