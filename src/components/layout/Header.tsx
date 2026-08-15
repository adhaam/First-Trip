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
  const cleanPath = pathname.replace(`/${locale}`, '') || '/'

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full transition-all duration-300',
        scrolled
          ? 'border-b border-sand-300/70 bg-sand-50/90 backdrop-blur-md supports-[backdrop-filter]:bg-sand-50/75'
          : 'border-b border-transparent bg-sand-50',
      )}
    >
      <div className="container-main flex h-[4.5rem] items-center justify-between gap-4">
        <Link href="/" aria-label="WEEMAP SINAI" className="shrink-0">
          <Logo size="md" priority />
        </Link>

        {/* Desktop nav — a single ink hairline rail rather than floating pills */}
        <nav className="hidden items-center lg:flex">
          {NAV_ITEMS.map((item) => {
            const labelKey = NAV_LABEL_KEYS[item.href] || 'home'
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative px-3 py-2 text-[0.9rem] font-medium transition-colors',
                  active ? 'text-sea-700' : 'text-sea-900/65 hover:text-sea-700',
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
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium text-sea-900/70 transition-colors hover:bg-sand-200 hover:text-sea-900"
          >
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">{otherLocale === 'ar' ? 'العربية' : 'English'}</span>
          </Link>

          <Link
            href="/book-dahab"
            className="hidden h-10 items-center gap-1.5 rounded-full bg-sea-900 px-5 text-sm font-semibold text-sand-50 transition-all hover:bg-sea-700 sm:inline-flex"
          >
            {locale === 'ar' ? 'احجز' : 'Book'}
            <ArrowUpRight className="h-4 w-4" />
          </Link>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className="inline-flex h-10 w-10 items-center justify-center rounded-full text-sea-900 transition-colors hover:bg-sand-200 lg:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">{locale === 'ar' ? 'القائمة' : 'Menu'}</span>
            </SheetTrigger>
            <SheetContent
              side={locale === 'ar' ? 'right' : 'left'}
              className="w-[290px] border-sand-300 bg-sand-50 sm:w-[330px]"
            >
              <SheetTitle className="sr-only">{locale === 'ar' ? 'القائمة' : 'Menu'}</SheetTitle>
              <div className="px-5 pt-5">
                <Logo size="md" />
              </div>
              <nav className="mt-6 flex flex-col px-3">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-3 text-[0.95rem] font-medium transition-colors',
                      isActive(item.href)
                        ? 'bg-sea-900 text-sand-50'
                        : 'text-sea-900/80 hover:bg-sand-200',
                    )}
                  >
                    <span aria-hidden className="text-base">{item.icon}</span>
                    <span>{item[locale === 'ar' ? 'label_ar' : 'label_en']}</span>
                  </Link>
                ))}
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
