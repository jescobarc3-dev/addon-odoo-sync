import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/portal/login',
  '/portal/magic',
  '/admin/login',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rutas de API y páginas públicas pasan siempre
  if (pathname.startsWith('/api') || PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Rutas admin → requieren admin_token
  if (pathname.startsWith('/admin')) {
    const adminToken = request.cookies.get('admin_token');
    if (!adminToken) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }
    return NextResponse.next();
  }

  // Raíz → redirigir al dashboard
  if (pathname === '/') {
    const portalToken = request.cookies.get('portal_token');
    if (!portalToken) {
      return NextResponse.redirect(new URL('/portal/login', request.url));
    }
    return NextResponse.redirect(new URL('/integracion-sap/dashboard', request.url));
  }

  // Todas las demás rutas → requieren portal_token
  const portalToken = request.cookies.get('portal_token');
  if (!portalToken) {
    const redirectUrl = new URL('/portal/login', request.url);
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
