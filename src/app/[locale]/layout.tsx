import type { Metadata } from 'next'
import {
  Plus_Jakarta_Sans,
  Almarai,
  Bricolage_Grotesque,
  Alexandria,
} from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { WhatsAppFloat } from '@/components/layout/WhatsAppFloat'
import { WeemapAI } from '@/components/ai/WeemapAI'
import { getSchemaOrg, getWebSiteSchema } from '@/lib/schema-org'
import { getSiteSettings } from '@/lib/data'
import { SITE_URL, siteSeo } from '@/lib/seo'
import { getPathname } from '@/i18n/navigation'
import { CartProvider } from '@/components/commerce/CartProvider'
import { CartDrawer } from '@/components/commerce/CartDrawer'
import { Analytics } from '@vercel/analytics/next'
import { AnalyticsScripts } from '@/components/analytics/AnalyticsScripts'
import { AnalyticsNoScript } from '@/components/analytics/AnalyticsNoScript'
import { jsonLdScript } from '@/lib/safe-html'
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

// ─── Display typeface pairing ───
// Latin: Bricolage Grotesque — a display grotesque with real character (the
// wonky, hand-set axis) that reads as editorial rather than SaaS-default.
// Arabic: Alexandria — an Egyptian-designed display face, built for headings
// at heavy weight without the letter-spacing/uppercase tricks that break
// Arabic legibility.
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  weight: ['600', '700', '800'],
  display: 'swap',
})

const alexandria = Alexandria({
  subsets: ['arabic'],
  variable: '--font-alexandria',
  weight: ['500', '600', '700', '800'],
  display: 'swap',
})


// SEO fields are owner-editable from the dashboard (Site Settings → SEO);
// anything left empty falls back to the WEEMAP defaults here.
export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const settings = await getSiteSettings().catch(() => null)
  const { title, description } = siteSeo(settings, locale)
  const socialImage = settings?.social_share_image || '/media/og-cover.jpg'
  const organizationName = settings?.organization_name || 'WEEMAP SINAI'
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
      apple: '/brand/icon-180.png',
    },
    openGraph: {
      title,
      description,
      type: 'website',
      locale: locale === 'ar' ? 'ar_EG' : 'en_US',
      // The other locale this same content is available in — og:locale:alternate.
      alternateLocale: locale === 'ar' ? 'en_US' : 'ar_EG',
      siteName: organizationName,
      images: [{ url: socialImage, width: 1200, height: 630, alt: organizationName }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [socialImage],
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
  const skipLabel = locale === 'ar' ? 'تخطَّ إلى المحتوى' : 'Skip to main content'
  const aiEnabled = process.env.NEXT_PUBLIC_WEEMAP_AI_ENABLED === 'true'
  const chatAvailable = aiEnabled
    && Boolean(process.env.WEEMAP_N8N_CHAT_WEBHOOK_URL?.trim())
    && Boolean(process.env.WEEMAP_N8N_CHAT_SECRET?.trim())

  const websiteSchema = getWebSiteSchema({
    locale,
    // Real public search results page (src/app/[locale]/search) — the
    // urlTemplate literally works if a crawler/assistant fills it in.
    searchUrlTemplate: `${SITE_URL}${getPathname({ href: '/search', locale })}?q={search_term_string}`,
  })

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(getSchemaOrg(settings)) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdScript(websiteSchema) }}
        />
      </head>
      <body
        className={`${jakarta.variable} ${almarai.variable} ${bricolage.variable} ${alexandria.variable} font-sans antialiased`}
      >
        <AnalyticsNoScript />
        <NextIntlClientProvider messages={messages} locale={locale}>
          <TooltipProvider>
            <CartProvider>
              <div className="flex min-h-screen flex-col">
                {/* First stop for a keyboard user. Without it they tab through
                    the logo, search, cart, language, Book and the whole nav on
                    every single navigation before reaching any page content. */}
                <a
                  href="#main-content"
                  className="sr-only rounded-b-lg bg-sea-900 px-5 py-3 text-sm font-semibold text-sand-50 focus-visible:not-sr-only focus-visible:fixed focus-visible:inset-x-0 focus-visible:top-0 focus-visible:z-[100] focus-visible:mx-auto focus-visible:w-fit focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun-300"
                >
                  {skipLabel}
                </a>
                <Header />
                <main id="main-content" tabIndex={-1} className="flex-1 outline-none">{children}</main>
                <Footer settings={settings} />
                {aiEnabled ? (
                  <WeemapAI
                    whatsappNumber={settings?.whatsapp_number}
                    chatAvailable={chatAvailable}
                  />
                ) : (
                  <WhatsAppFloat number={settings?.whatsapp_number} />
                )}
                <CartDrawer />
              </div>
            </CartProvider>
          </TooltipProvider>
        </NextIntlClientProvider>
        <Analytics />
        <AnalyticsScripts />
      </body>
    </html>
  )
}
