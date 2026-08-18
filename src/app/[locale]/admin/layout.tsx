import type { Metadata } from 'next'

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  return {
    title: locale === 'ar' ? 'مركز تحكم WEEMAP' : 'WEEMAP Business Control Center',
    robots: { index: false, follow: false },
  }
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children
}
