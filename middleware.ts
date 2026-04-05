import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import createIntlMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

const intlMiddleware = createIntlMiddleware(routing)

const protectedPatterns = ['/sessions', '/templates', '/outputs', '/settings', '/calls', '/profile', '/admin', '/marketplace', '/projects']
const publicPatterns = ['/api/', '/auth/', '/_next/', '/favicon', '/icon-', '/apple-touch', '/manifest', '/og-image', '/sw.js']

function isPublicAsset(pathname: string) {
  return publicPatterns.some((p) => pathname.startsWith(p))
}

function stripLocalePrefix(pathname: string): string {
  for (const locale of routing.locales) {
    if (locale === routing.defaultLocale) continue
    if (pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`) {
      return pathname.slice(locale.length + 1) || '/'
    }
  }
  return pathname
}

function isProtectedRoute(pathname: string): boolean {
  const bare = stripLocalePrefix(pathname)
  return protectedPatterns.some((p) => bare.startsWith(p))
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/api/') || isPublicAsset(pathname)) {
    return NextResponse.next()
  }

  const intlResponse = intlMiddleware(request)

  if (!isProtectedRoute(pathname)) {
    if (pathname === '/login' || pathname === '/signup' || pathname.startsWith('/de/login') || pathname.startsWith('/es/login') || pathname.startsWith('/de/signup') || pathname.startsWith('/es/signup')) {
      intlResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
      intlResponse.headers.set('Pragma', 'no-cache')
      intlResponse.headers.set('Expires', '0')
    }
    return intlResponse
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set(name, value)
          intlResponse.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: any) {
          request.cookies.delete(name)
          intlResponse.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const locale = stripLocalePrefix(pathname) !== pathname
      ? pathname.split('/')[1]
      : routing.defaultLocale
    const loginPath = locale === routing.defaultLocale ? '/login' : `/${locale}/login`
    const loginUrl = new URL(loginPath, request.url)
    return NextResponse.redirect(loginUrl)
  }

  intlResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  intlResponse.headers.set('Pragma', 'no-cache')
  intlResponse.headers.set('Expires', '0')

  return intlResponse
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
}
