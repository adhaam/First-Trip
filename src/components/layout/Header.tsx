'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Logo } from '@/components/brand/Logo'
import { NAV_ITEMS, NAV_LABEL_KEYS } from '@/lib/constants'
import { Menu, Globe, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Header() {
  const t = useTranslations('nav')
  const locale = useLocale()
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 16)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const isActive = (href: string) => {
    if (href === '/') return pathname === `/${locale}` || pathname === `/${locale}/` || pathname === '/'
    return pathname.startsWith(`/${locale}${href}`) || pathname.startsWith(href)
  }

  const otherLocale = locale === 'ar' ? 'en' : 'ar'
  const cleanPath = pathname.replace(/^\/(?:ar|en)(?=\/|$)/, '') || '/'

  // The homepage opens on a full-bleed dark video hero — the header starts
  // transparent with light text over it, then crossfades into the normal
  // solid header once the visitor scrolls past it. Every other page has no
  // hero to be transparent over, so it stays solid from the start.
  const isHome = pathname === `/${locale}` || pathname === `/${locale}/` || pathname === '/'
  const transparent = isHome && !scrolled
  const isAdminRoute =
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/en/admin' ||
    pathname.startsWith('/en/admin/')

  if (isAdminRoute) return null

  return (
    <header
      className={cn(
        'top-0 z-50 w-full transition-all duration-300',
        isHome ? 'fixed' : 'sticky',
        scrolled
          ? 'border-b border-sand-300/70 bg-sand-50/90 backdrop-blur-md supports-[backdrop-filter]:bg-sand-50/75'
          : transparent
            ? 'border-b border-transparent bg-transparent'
            : 'border-b border-transparent bg-sand-50',
      )}
    >
      <div className="container-main flex h-[4.5rem] items-center justify-between gap-4">
        <Link href="/" aria-label="WEEMAP SINAI" className="shrink-0">
          <Logo size="md" priority tone={transparent ? 'light' : 'ink'} />
        </Link>

        {/* Desktop nav — a single ink hairline rail rather than floating pills */}
        <nav className="hidden items-center xl:flex">
          {NAV_ITEMS.map((item) => {
            const labelKey = NAV_LABEL_KEYS[item.href] || 'home'
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative px-3 py-2 text-[0.9rem] font-medium transition-colors',
                  transparent
                    ? active ? 'text-white' : 'text-white/75 hover:text-white'
                    : active ? 'text-sea-700' : 'text-sea-900/65 hover:text-sea-700',
                )}
              >
                {t(labelKey)}
                <span
                  aria-hidden
                  className={cn(
                    'absolute inset-x-2 -bottom-0.5 h-[2px] origin-center rounded-full bg-sun-400 transition-transform duration-300',
                    active ? 'scale-x-100' : 'scale-x-0',
                  )}
                />
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-1.5">
          <Link
            href={cleanPath}
            locale={otherLocale}
            aria-label={otherLocale === 'ar' ? 'التبديل إلى العربية' : 'Switch to English'}
            className={cn(
              'inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors',
              transparent
                ? 'text-white/85 hover:bg-white/10 hover:text-white'
                : 'text-sea-900/70 hover:bg-sand-200 hover:text-sea-900',
            )}
          >
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">{otherLocale === 'ar' ? 'العربية' : 'English'}</span>
          </Link>

          <Link
            href="/book-dahab"
            className={cn(
              'hidden h-11 items-center gap-1.5 rounded-full px-5 text-sm font-semibold transition-all sm:inline-flex',
              transparent
                ? 'bg-white text-sea-900 hover:bg-sand-100'
                : 'bg-sun-500 text-white hover:bg-sun-600',
            )}
          >
            {locale === 'ar' ? 'احجز' : 'Book'}
            <ArrowUpRight className="h-4 w-4" />
          </Link>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              className={cn(
                'inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors xl:hidden',
                transparent ? 'text-white hover:bg-white/10' : 'text-sea-900 hover:bg-sand-200',
              )}
            >
              <Menu className="h-5 w-5" />
              <span className="sr-only">{locale === 'ar' ? 'القائمة' : 'Menu'}</span>
            </SheetTrigger>
            <SheetContent
              side={locale === 'ar' ? 'right' : 'left'}
              closeLabel={locale === 'ar' ? 'إغلاق القائمة' : 'Close menu'}
              className="w-[290px] border-sand-300 bg-sand-50 sm:w-[330px]"
            >
              <SheetTitle className="sr-only">{locale === 'ar' ? 'القائمة' : 'Menu'}</SheetTitle>
              <div className="px-5 pt-5">
                <Logo size="md" />
              </div>
              <nav className="mt-6 flex flex-col px-3">
                {NAV_ITEMS.map((item) => {
                  const active = isActive(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex min-h-11 items-center gap-3 rounded-xl px-3 py-3 text-[0.95rem] font-medium transition-colors',
                        active ? 'bg-sun-500 text-white' : 'text-sea-900/80 hover:bg-sand-200',
                      )}
                    >
                      <span aria-hidden className="text-base">{item.icon}</span>
                      <span>{t(NAV_LABEL_KEYS[item.href] || 'home')}</span>
                    </Link>
                  )
                })}
              </nav>
              <div className="mt-6 px-5">
                <Link
                  href="/book-dahab"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-sun-400 text-sm font-semibold text-white transition-colors hover:bg-sun-500"
                >
                  {locale === 'ar' ? 'احجز رحلتك' : 'Book your trip'}
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
