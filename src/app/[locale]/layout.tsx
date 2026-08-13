import type { Metadata } from 'next'
import {
  Bricolage_Grotesque,
  IBM_Plex_Sans,
  IBM_Plex_Sans_Arabic,
  Noto_Kufi_Arabic,
} from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { WhatsAppFloat } from '@/components/layout/WhatsAppFloat'
import { getSchemaOrg } from '@/lib/schema-org'
import { getSiteSettings } from '@/lib/data'
import '../globals.css'

// ─── Typeface pairing ───
// Display: Bricolage Grotesque (latin) / Noto Kufi Arabic (arabic) — both have
// real personality and structural weight, so headings don't read as a template.
// Body: IBM Plex Sans + IBM Plex Sans Arabic — one humanist family across both
// scripts, which keeps mixed AR/EN lines visually consistent.
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

const kufi = Noto_Kufi_Arabic({
  subsets: ['arabic'],
  variable: '--font-kufi',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

const plex = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-plex',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  variable: '--font-plex-ar',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL('https://firsttrip-eg.com'),
  title: {
    default: 'First Trip – رحلات منظمة لدهب | باقات سياحية شاملة',
    template: '%s | First Trip',
  },
  description: 'First Trip – شركة سياحة في دهب متخصصة في الباقات الشاملة، حجز الفنادق والشاليهات والكمبات، والرحلات الداخلية في جنوب سيناء',
  keywords: 'دهب, سياحة, رحلات, باقات سياحية, فنادق دهب, شاليهات, جنوب سيناء, البحر الأحمر, Dahab, Egypt, tourism, packages',
  authors: [{ name: 'First Trip' }],
  // src/app/favicon.ico is served automatically at /favicon.ico by Next's file
  // convention — only the apple-touch-icon needs to be declared explicitly.
  icons: {
    apple: '/logo.png',
  },
  openGraph: {
    title: 'First Trip – رحلات منظمة لدهب',
    description: 'باقات سياحية شاملة — انتقالات، إقامة، ورحلات داخلية من محافظتك لدّهب',
    type: 'website',
    locale: 'ar_EG',
    siteName: 'First Trip',
    images: [{ url: '/logo.png', width: 1200, height: 1200, alt: 'First Trip' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'First Trip – رحلات منظمة لدهب',
    description: 'باقات سياحية شاملة — انتقالات، إقامة، ورحلات داخلية من محافظتك لدهب',
    images: ['/logo.png'],
  },
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const messages = await getMessages()
  const settings = await getSiteSettings()
  const dir = locale === 'ar' ? 'rtl' : 'ltr'

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(getSchemaOrg()) }}
        />
      </head>
      <body
        className={`${bricolage.variable} ${kufi.variable} ${plex.variable} ${plexArabic.variable} font-sans antialiased`}
      >
        <NextIntlClientProvider messages={messages} locale={locale}>
          <TooltipProvider>
            <div className="flex min-h-screen flex-col">
              <Header />
              <main className="flex-1">{children}</main>
              <Footer settings={settings} />
              <WhatsAppFloat number={settings?.whatsapp_number} />
            </div>
          </TooltipProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}