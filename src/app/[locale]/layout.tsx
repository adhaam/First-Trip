import type { Metadata } from 'next'
import {
  Bricolage_Grotesque,
  IBM_Plex_Sans,
  IBM_Plex_Sans_Arabic,
  Tajawal,
} from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { WhatsAppFloat } from '@/components/layout/WhatsAppFloat'
import { NewsletterSignup } from '@/components/NewsletterSignup'
import { getSchemaOrg } from '@/lib/schema-org'
import { getSiteSettings } from '@/lib/data'
import '../globals.css'

// ─── Typeface pairing ───
// Display: Bricolage Grotesque (latin) — expressive, modern.
// Arabic: Tajawal — the modern Arabic used by Careem/Anghami/Talabat. Feels
// current, warm, and pairs beautifully with Bricolage without looking retro.
// Body: IBM Plex Sans (latin) + IBM Plex Sans Arabic (arabic) as a humanist
// backup for body copy — Tajawal handles headings, Plex handles long-form text.
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  variable: '--font-tajawal',
  weight: ['400', '500', '700', '800'],
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
    default: 'First Trip — دهب مش رحلة، دي كوميونيتي',
    template: '%s | First Trip',
  },
  description: 'First Trip — أول رحلة ليك لدهب. باقات، إقامة، انتقالات، ورحلات سيناء. من 2017 بننظم رحلات لكوميونيتي بيحبوا الحرية والبحر والصحراء.',
  keywords: 'دهب, سياحة, رحلات, باقات سياحية, فنادق دهب, شاليهات, جنوب سيناء, البحر الأحمر, Dahab, Egypt, tourism, packages, Sinai',
  authors: [{ name: 'First Trip' }],
  // src/app/favicon.ico is served automatically at /favicon.ico by Next's file
  // convention — only the apple-touch-icon needs to be declared explicitly.
  icons: {
    apple: '/logo.png',
  },
  openGraph: {
    title: 'First Trip — دهب مش رحلة، دي كوميونيتي',
    description: 'انتقالات، إقامة، ورحلات — إحنا بنظبط كل حاجة، إنت بس تعيشها.',
    type: 'website',
    locale: 'ar_EG',
    siteName: 'First Trip',
    images: [{ url: '/logo.png', width: 1200, height: 1200, alt: 'First Trip' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'First Trip — دهب مش رحلة، دي كوميونيتي',
    description: 'انتقالات، إقامة، ورحلات — إحنا بنظبط كل حاجة، إنت بس تعيشها.',
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
        className={`${bricolage.variable} ${tajawal.variable} ${plex.variable} ${plexArabic.variable} font-sans antialiased`}
      >
        <NextIntlClientProvider messages={messages} locale={locale}>
          <TooltipProvider>
            <div className="flex min-h-screen flex-col">
              <Header />
              <main className="flex-1">{children}</main>
              <NewsletterSignup />
              <Footer settings={settings} />
              <WhatsAppFloat number={settings?.whatsapp_number} />
            </div>
          </TooltipProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}