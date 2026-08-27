'use client'

import { useEffect, useState } from 'react'
import { WHATSAPP_NUMBER } from '@/lib/constants'
import { MessageCircle } from 'lucide-react'
import { useLocale } from 'next-intl'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { trackEvent } from '@/lib/track'

/**
 * Floating WhatsApp button.
 * Collapses to a circle once the visitor starts scrolling so it stops covering
 * content on small screens, and expands again on hover/focus.
 */
export function WhatsAppFloat({ number }: { number?: string | null }) {
  const locale = useLocale()
  const pathname = usePathname()
  const [compact, setCompact] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount flag to trigger the entrance transition
    setMounted(true)
    const onScroll = () => setCompact(window.scrollY > 260)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const digits = (number || WHATSAPP_NUMBER).replace(/[^0-9]/g, '')
  const isAdminRoute =
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/en/admin' ||
    pathname.startsWith('/en/admin/')

  if (isAdminRoute) return null

  return (
    <a
      href={`https://wa.me/${digits}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp"
      onClick={() => trackEvent('whatsapp_cta_click', { source: 'floating_button' })}
      className={cn(
        'group fixed bottom-5 z-50 flex items-center gap-2 rounded-full bg-[#25D366] py-3 text-white shadow-[0_6px_24px_-6px_rgba(0,0,0,0.5)] transition-all duration-300 hover:bg-[#1FBE59] focus-visible:ring-2 focus-visible:ring-white/70',
        compact ? 'px-3.5' : 'px-4',
        mounted ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0',
        locale === 'ar' ? 'left-5' : 'right-5',
      )}
    >
      <MessageCircle className="h-5 w-5 shrink-0" />
      <span
        className={cn(
          'overflow-hidden whitespace-nowrap text-sm font-semibold transition-all duration-300',
          compact ? 'max-w-0 opacity-0 group-hover:max-w-[7rem] group-hover:opacity-100' : 'max-w-[7rem] opacity-100',
        )}
      >
        {locale === 'ar' ? 'كلمنا' : 'WhatsApp'}
      </span>
    </a>
  )
}
