'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Logo } from '@/components/brand/Logo'
import { NAV_ITEMS, NAV_LABEL_KEYS } from '@/lib/constants'
import {
  ArrowUpRight,
  BedDouble,
  Bike,
  BookOpen,
  ChevronDown,
  Globe,
  Handshake,
  Home,
  Menu,
  Mountain,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCart } from '@/components/commerce/CartProvider'
import { GlobalSearch } from '@/components/layout/GlobalSearch'

/**
 * Lucide glyphs for the navigation. Emoji were used here before — they render
 * differently on every platform, never inherit the brand colour, and screen
 * readers announce them literally in the middle of a link label.
 */
const NAV_ICONS: Record<string, LucideIcon> = {
  home: Home,
  bed: BedDouble,
  mountain: Mountain,
  sparkles: Sparkles,
  bag: ShoppingBag,
  bike: Bike,
  users: Users,
  handshake: Handshake,
  book: BookOpen,
  shield: ShieldCheck,
}

/** Section headings for the mobile drawer, so ten links read as three groups. */
const DRAWER_GROUPS = [
  { key: 'plan', labelKey: 'groupPlan' },
  { key: 'shop', labelKey: 'groupShop' },
  { key: 'weemap', labelKey: 'groupWeemap' },
] as const

export function Header() {
  const t = useTranslations('nav')
  const locale = useLocale()
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const cart = useCart()

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

  // Two tiers. The five revenue routes sit in the bar from `lg` up; everything
  // else lives under "More". Previously all ten items were `xl:flex`, so every
  // visitor between 1024px and 1279px — iPad landscape, most 13" laptops — got
  // a hamburger next to an almost empty header.
  const primaryItems = NAV_ITEMS.filter((item) => item.primary)
  const secondaryItems = NAV_ITEMS.filter((item) => !item.primary && item.href !== '/')
  const moreActive = secondaryItems.some((item) => isActive(item.href))

  if (isAdminRoute) return null

  return (
    <header
      className={cn(
        'top-0 z-50 w-full transition-all duration-300',
        isHome ? 'fixed' : 'sticky',
        scrolled
          ? 'border-b border-white/10 bg-weemap-charcoal/90 backdrop-blur-md supports-[backdrop-filter]:bg-weemap-charcoal/75'
          : transparent
            ? 'border-b border-transparent bg-transparent'
            : 'border-b border-white/10 bg-weemap-charcoal',
      )}
    >
      <div className="container-main flex h-[4.5rem] items-center justify-between gap-3">
        <Link
          href="/"
          aria-label="WEEMAP SINAI"
          className="inline-flex shrink-0 items-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sun-300"
        >
          <Logo size="md" priority tone="light" />
        </Link>

        {/* Desktop nav — a single ink hairline rail rather than floating pills */}
        <nav className="hidden items-center lg:flex" aria-label={t('primaryLabel')}>
          {primaryItems.map((item) => {
            const labelKey = NAV_LABEL_KEYS[item.href] || 'home'
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative whitespace-nowrap px-2.5 py-2 text-[0.875rem] font-medium transition-colors xl:px-3 xl:text-[0.9rem]',
                  'rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-300',
                  active ? 'text-white' : 'text-white/80 hover:text-white',
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

          {/* Secondary routes. base-ui's dropdown gives keyboard navigation,
              Escape-to-close, click-outside and focus return for free. */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                'relative inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2.5 py-2 text-[0.875rem] font-medium transition-colors xl:px-3 xl:text-[0.9rem]',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-300',
                moreActive ? 'text-white' : 'text-white/80 hover:text-white',
              )}
            >
              {t('more')}
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              <span
                aria-hidden
                className={cn(
                  'absolute inset-x-2 -bottom-0.5 h-[2px] origin-center rounded-full bg-sun-400 transition-transform duration-300',
                  moreActive ? 'scale-x-100' : 'scale-x-0',
                )}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56 border-sand-300 bg-sand-50 p-1.5">
              {secondaryItems.map((item) => {
                const Icon = NAV_ICONS[item.icon || 'home']
                const active = isActive(item.href)
                return (
                  <DropdownMenuItem
                    key={item.href}
                    className={cn(
                      'min-h-11 gap-2.5 rounded-lg px-2.5 text-sm font-medium text-sea-900',
                      active && 'bg-sand-200',
                    )}
                    render={
                      <Link href={item.href} aria-current={active ? 'page' : undefined} />
                    }
                  >
                    {Icon && <Icon className="h-4 w-4 shrink-0 text-sun-700" aria-hidden />}
                    {t(NAV_LABEL_KEYS[item.href] || 'home')}
                  </DropdownMenuItem>
                )
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>

        <div className="flex items-center gap-1.5">
          <GlobalSearch />

          <button
            type="button"
            onClick={cart.open}
            aria-label={t('cartLabel')}
            className={cn(
              'relative inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors',
              'text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-300',
            )}
          >
            <ShoppingBag className="h-5 w-5" aria-hidden />
            {cart.hydrated && cart.count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-sun-500 px-1 text-[10px] font-bold text-on-accent">
                {cart.count > 9 ? '9+' : cart.count}
              </span>
            )}
          </button>

          <Link
            href={cleanPath}
            locale={otherLocale}
            aria-label={otherLocale === 'ar' ? 'التبديل إلى العربية' : 'Switch to English'}
            className={cn(
              'inline-flex h-11 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium transition-colors',
              'text-white/85 hover:bg-white/10 hover:text-white',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-300',
            )}
          >
            <Globe className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">{otherLocale === 'ar' ? 'العربية' : 'English'}</span>
          </Link>

          <Link
            href="/book-dahab"
            className={cn(
              'hidden h-11 items-center gap-1.5 rounded-full px-5 text-sm font-semibold transition-all sm:inline-flex',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-300',
              transparent
                ? 'bg-white text-sea-900 hover:bg-sand-100'
                : 'bg-sun-500 text-on-accent hover:bg-sun-600',
            )}
          >
            {t('bookCta')}
            <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
          </Link>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger
              className={cn(
                'inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors lg:hidden',
                'text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-300',
              )}
            >
              <Menu className="h-5 w-5" aria-hidden />
              <span className="sr-only">{t('menu')}</span>
            </SheetTrigger>
            <SheetContent
              side={locale === 'ar' ? 'right' : 'left'}
              closeLabel={t('closeMenu')}
              className="w-[300px] overflow-y-auto border-sand-300 bg-sand-50 sm:w-[340px]"
            >
              <SheetTitle className="sr-only">{t('menu')}</SheetTitle>
              <div className="px-5 pt-5">
                <Logo size="md" />
              </div>

              <nav className="mt-6 flex flex-col gap-5 px-3 pb-6" aria-label={t('menu')}>
                {DRAWER_GROUPS.map((group) => {
                  const items = NAV_ITEMS.filter((item) => item.group === group.key)
                  if (items.length === 0) return null
                  return (
                    <div key={group.key}>
                      <h2 className="px-3 pb-1.5 text-[0.7rem] font-bold uppercase tracking-[0.18em] text-ink-subtle">
                        {t(group.labelKey)}
                      </h2>
                      <ul className="flex flex-col">
                        {items.map((item) => {
                          const Icon = NAV_ICONS[item.icon || 'home']
                          const active = isActive(item.href)
                          return (
                            <li key={item.href}>
                              <Link
                                href={item.href}
                                onClick={() => setOpen(false)}
                                aria-current={active ? 'page' : undefined}
                                className={cn(
                                  'flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-[0.95rem] font-medium transition-colors',
                                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-700',
                                  active
                                    ? 'bg-sun-500 text-on-accent'
                                    : 'text-sea-900 hover:bg-sand-200',
                                )}
                              >
                                {Icon && (
                                  <Icon
                                    className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-on-accent' : 'text-sun-700')}
                                    aria-hidden
                                  />
                                )}
                                <span>{t(NAV_LABEL_KEYS[item.href] || 'home')}</span>
                              </Link>
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )
                })}
              </nav>

              <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
                <Link
                  href="/book-dahab"
                  onClick={() => setOpen(false)}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-sun-500 text-sm font-semibold text-on-accent transition-colors hover:bg-sun-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-700"
                >
                  {t('bookTripCta')}
                  <ArrowUpRight className="h-4 w-4 rtl:-scale-x-100" aria-hidden />
                </Link>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
