import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Domain-based route isolation middleware.
 * 
 * In production, each portal runs on its own domain:
 *   - orders.yourco.com     → buyer portal (public routes only)
 *   - admin.yourco.internal → admin portal (VPN/IP-allowlisted)
 *   - pack.yourco.internal  → production portal (LAN-only)
 * 
 * In development (localhost), all routes are accessible for convenience.
 * The middleware enforces isolation only when running on production domains.
 */

const DOMAIN_RULES: Record<string, { allowed: string[]; blocked: string[] }> = {
  // Public buyer portal — block admin and production routes
  'orders': {
    allowed: ['/'],
    blocked: ['/admin', '/production'],
  },
  // Admin portal — block production routes, allow admin
  'admin': {
    allowed: ['/admin'],
    blocked: ['/production'],
  },
  // Production portal — block admin routes, allow production
  'pack': {
    allowed: ['/production'],
    blocked: ['/admin'],
  },
};

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const pathname = request.nextUrl.pathname;

  // In development (localhost), allow everything
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return NextResponse.next();
  }

  // Determine which portal based on subdomain
  let portalKey: string | null = null;
  for (const key of Object.keys(DOMAIN_RULES)) {
    if (hostname.startsWith(key)) {
      portalKey = key;
      break;
    }
  }

  // If no matching domain rule, allow (unknown/custom domains)
  if (!portalKey) {
    return NextResponse.next();
  }

  const rules = DOMAIN_RULES[portalKey];

  // Check if the path is blocked for this domain
  for (const blockedPath of rules.blocked) {
    if (pathname.startsWith(blockedPath)) {
      // Return 404 — don't reveal that the route exists
      return new NextResponse(null, { status: 404, statusText: 'Not Found' });
    }
  }

  return NextResponse.next();
}

export const config = {
  // Apply middleware to all routes except static assets and API routes
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
