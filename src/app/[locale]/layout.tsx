import type { Metadata } from 'next'
import {
  Plus_Jakarta_Sans,
  Almarai,
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
// Latin: Plus Jakarta Sans — warm, rounded terminals, very readable at both
// body and display sizes without the stark geometric edge of the old font.
// Arabic: Almarai — soft, rounded, built specifically to feel comfortable and
// friendly to read at length, even at heavy weights. Pairs naturally with
// Plus Jakarta Sans' own roundness.
const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
})

const almarai = Almarai({
  subsets: ['arabic'],
  variable: '--font-almarai',
  weight: ['400', '700', '800'],
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
        className={`${jakarta.variable} ${almarai.variable} font-sans antialiased`}
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