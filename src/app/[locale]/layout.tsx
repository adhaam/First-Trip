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
import { SITE_URL } from '@/lib/seo'
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

const DEFAULT_TITLE = 'WEEMAP SINAI — We map Sinai. You live it.'
const DEFAULT_DESC_AR = 'WEEMAP SINAI — باقات، إقامة، انتقالات، ورحلات سيناء. بنرسم لك الطريق لدهب وجنوب سيناء — إنت بس تعيشها.'

// SEO fields are owner-editable from the dashboard (Site Settings → SEO);
// anything left empty falls back to the WEEMAP defaults here.
export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const settings = await getSiteSettings().catch(() => null)
  const title = settings?.seo_title || DEFAULT_TITLE
  const description =
    (locale === 'ar' ? settings?.seo_description_ar : settings?.seo_description_en) ||
    DEFAULT_DESC_AR
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: title,
      template: '%s | WEEMAP SINAI',
    },
    description,
    keywords: 'دهب, سيناء, سياحة, رحلات, باقات سياحية, فنادق دهب, شاليهات, جنوب سيناء, البحر الأحمر, Dahab, Sinai, Egypt, travel, packages, WEEMAP',
    authors: [{ name: 'WEEMAP' }],
    // src/app/favicon.ico is served automatically at /favicon.ico by Next's file
    // convention — only the apple-touch-icon needs to be declared explicitly.
    icons: {
      apple: '/logo.png',
    },
    openGraph: {
      title,
      description,
      type: 'website',
      locale: locale === 'ar' ? 'ar_EG' : 'en_US',
      // The other locale this same content is available in — og:locale:alternate.
      alternateLocale: locale === 'ar' ? 'en_US' : 'ar_EG',
      siteName: 'WEEMAP SINAI',
      images: [{ url: '/logo.png', width: 1200, height: 1200, alt: 'WEEMAP SINAI' }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ['/logo.png'],
    },
  }
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
          dangerouslySetInnerHTML={{ __html: JSON.stringify(getSchemaOrg(settings)) }}
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
              {settings?.show_newsletter !== false && <NewsletterSignup />}
              <Footer settings={settings} />
              <WhatsAppFloat number={settings?.whatsapp_number} />
            </div>
          </TooltipProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}