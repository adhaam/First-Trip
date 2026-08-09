'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { ButtonLink } from '@/components/ButtonLink'
import { NAV_ITEMS, NAV_LABEL_KEYS } from '@/lib/constants'
import { Menu, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Header() {
  const t = useTranslations('nav')
  const locale = useLocale()
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const isActive = (href: string) => {
    if (href === '/') return pathname === `/${locale}` || pathname === `/${locale}/`
    return pathname.startsWith(`/${locale}${href}`)
  }

  const otherLocale = locale === 'ar' ? 'en' : 'ar'
  const cleanPath = pathname.replace(`/${locale}`, '') || '/'

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full border-b transition-all duration-300',
        scrolled
          ? 'bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 border-gray-200 shadow-sm'
          : 'bg-white border-transparent'
      )}
    >
      <div className="container-main flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex flex-col items-center">
            <div className="w-6 h-6 rounded-full border-2 border-[#00A0E0] bg-transparent" />
            <div className="w-0 h-0 border-l-[9px] border-r-[9px] border-t-[12px] border-l-transparent border-r-transparent border-t-[#F08020] -mt-[2px]" />
          </div>
          <span className="text-lg font-bold hidden sm:inline-block">
            <span className="text-[#00A0E0]">FIRST</span>{' '}
            <span className="text-[#F08020]">TRIP</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const labelKey = NAV_LABEL_KEYS[item.href] || 'home'
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'px-3 py-2 text-sm font-medium rounded-md transition-colors',
                  isActive(item.href)
                    ? 'text-brand-blue bg-blue-50'
                    : 'text-gray-600 hover:text-brand-blue hover:bg-gray-50'
                )}
              >
                <span className="hidden xl:inline mr-1">{item.icon}</span>
                {t(labelKey)}
              </Link>
            )
          })}
        </nav>

        {/* Language Toggle + Mobile Menu */}
        <div className="flex items-center gap-2">
          <ButtonLink href={cleanPath} variant="ghost" size="default" className="gap-1.5 !h-9 !px-3">
            <Globe className="h-4 w-4" />
            <span className="hidden sm:inline">{otherLocale === 'ar' ? 'العربية' : 'English'}</span>
          </ButtonLink>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className="lg:hidden inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-muted">
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side={locale === 'ar' ? 'right' : 'left'} className="w-[280px] sm:w-[320px]">
              <div className="flex flex-col gap-1 mt-8">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-md transition-colors',
                      isActive(item.href)
                        ? 'text-brand-blue bg-blue-50'
                        : 'text-gray-600 hover:text-brand-blue hover:bg-gray-50'
                    )}
                  >
                    <span>{item.icon}</span>
                    <span>{item[locale === 'ar' ? 'label_ar' : 'label_en']}</span>
                  </Link>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
