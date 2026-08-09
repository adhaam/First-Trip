import type { Metadata } from 'next'
import { Cairo, Inter } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { WhatsAppFloat } from '@/components/layout/WhatsAppFloat'
import { getSchemaOrg } from '@/lib/schema-org'
import '../globals.css'

const cairo = Cairo({
  subsets: ['arabic'],
  variable: '--font-arabic',
  display: 'swap',
})

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'First Trip – رحلات منظمة لدهب | باقات سياحية شاملة',
  description: 'First Trip – شركة سياحة في دهب متخصصة في الباقات الشاملة، حجز الفنادق والشاليهات والكمبات، والرحلات الداخلية في جنوب سيناء',
  keywords: 'دهب, سياحة, رحلات, باقات سياحية, فنادق دهب, شاليهات, جنوب سيناء, البحر الأحمر, Dahab, Egypt, tourism, packages',
  authors: [{ name: 'First Trip' }],
  openGraph: {
    title: 'First Trip – رحلات منظمة لدهب',
    description: 'باقات سياحية شاملة — انتقالات، إقامة، ورحلات داخلية من محافظتك لدّهب',
    type: 'website',
    locale: 'ar_EG',
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
  const dir = locale === 'ar' ? 'rtl' : 'ltr'

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(getSchemaOrg()) }}
        />
      </head>
      <body className={`${cairo.variable} ${inter.variable} font-sans antialiased`}>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <TooltipProvider>
            <div className="flex min-h-screen flex-col">
              <Header />
              <main className="flex-1">{children}</main>
              <Footer />
              <WhatsAppFloat />
            </div>
          </TooltipProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}