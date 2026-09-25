import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'
import { NextRequest, NextResponse } from 'next/server'
import { ADMIN_COOKIE, verifyAdminSessionToken } from './lib/admin-session'

const intlProxy = createMiddleware(routing)

// Page gate only: a valid signed cookie is required to load the dashboard
// shell. Revocation and role permissions are enforced by requireStaff() on
// every admin API call, which is where all data comes from.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const dashboardMatch = pathname.match(/^\/(?:([a-z]{2})\/)?admin\/dashboard(?:\/|$)/)

  if (dashboardMatch) {
    const token = req.cookies.get(ADMIN_COOKIE)?.value
    if (!(await verifyAdminSessionToken(token))) {
      const locale = dashboardMatch[1]
      return NextResponse.redirect(new URL(locale === 'en' ? '/en/admin' : '/admin', req.url))
    }
  }

  return intlProxy(req)
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
