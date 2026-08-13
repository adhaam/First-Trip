import createMiddleware from 'next-intl/middleware'
import { routing } from './src/i18n/routing'
import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE, verifyAdminSessionToken } from './src/lib/admin-auth'

const intlMiddleware = createMiddleware(routing)

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Gate /{locale}/admin/dashboard — everything under it requires a valid
  // admin session cookie, otherwise bounce to the login page for that locale.
  const dashboardMatch = pathname.match(/^\/([a-z]{2})\/admin\/dashboard(\/|$)/)
  if (dashboardMatch) {
    const token = req.cookies.get(ADMIN_COOKIE)?.value
    const valid = await verifyAdminSessionToken(token)
    if (!valid) {
      const locale = dashboardMatch[1]
      return NextResponse.redirect(new URL(`/${locale}/admin`, req.url))
    }
  }

  return intlMiddleware(req)
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
