import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const protectedRoutes = ['/dashboard', '/sessions'];
  const publicRoutes = ['/login', '/api/auth'];

  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  if (isProtectedRoute) {
    const supabaseToken = request.cookies.get('sb-access-token')?.value;
    const phoneSessionData = request.cookies.get('phone_auth_session')?.value;

    let hasValidSession = false;

    if (supabaseToken) {
      try {
        const supabase = createClient(supabaseUrl, supabaseAnonKey);
        const { data: { user } } = await supabase.auth.getUser(supabaseToken);
        hasValidSession = !!user;
      } catch (error) {
        hasValidSession = false;
      }
    }

    if (!hasValidSession && phoneSessionData) {
      try {
        const phoneSession = JSON.parse(phoneSessionData);
        if (phoneSession.expiresAt > Date.now()) {
          hasValidSession = true;
        }
      } catch (error) {
        hasValidSession = false;
      }
    }

    if (!hasValidSession && typeof window !== 'undefined') {
      try {
        const localStorageSession = localStorage.getItem('phone_auth_session');
        if (localStorageSession) {
          const phoneSession = JSON.parse(localStorageSession);
          if (phoneSession.expiresAt > Date.now()) {
            hasValidSession = true;
          }
        }
      } catch (error) {
        hasValidSession = false;
      }
    }

    if (!hasValidSession) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/sessions/:path*'],
};
