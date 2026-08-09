'use client'

import { useTranslations, useLocale } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { motion } from 'framer-motion'
import { Shield, FileText, RefreshCcw, Lock } from 'lucide-react'

export default function PolicyPage() {
  const t = useTranslations('policy')
  const locale = useLocale()

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-blue to-brand-blue-dark text-white py-20 md:py-24 text-center">
        <div className="container-main">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Shield className="h-12 w-12 mx-auto mb-4 opacity-90" />
            <h1 className="text-4xl md:text-5xl font-extrabold mb-3">{t('title')}</h1>
            <p className="text-blue-100 max-w-2xl mx-auto">
              {locale === 'ar'
                ? 'سياساتنا واضحة وشفافة — اقرأها قبل الحجز'
                : 'Our policies are clear & transparent — please read before booking'}
            </p>
          </motion.div>
        </div>
      </section>

      <section className="section-padding bg-gray-50">
        <div className="container-main max-w-4xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <CardContent className="p-6 md:p-10">
                <Tabs defaultValue="booking" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
                  <TabsList className="grid grid-cols-2 md:grid-cols-4 mb-8 w-full h-auto">
                    <TabsTrigger value="booking" className="flex items-center gap-1.5 text-xs md:text-sm py-3">
                      <FileText className="h-4 w-4" />
                      <span className="hidden sm:inline">{t('booking')}</span>
                      <span className="sm:hidden">{locale === 'ar' ? 'حجز' : 'Booking'}</span>
                    </TabsTrigger>
                    <TabsTrigger value="cancellation" className="flex items-center gap-1.5 text-xs md:text-sm py-3">
                      <RefreshCcw className="h-4 w-4" />
                      <span className="hidden sm:inline">{t('cancellation')}</span>
                      <span className="sm:hidden">{locale === 'ar' ? 'إلغاء' : 'Cancel'}</span>
                    </TabsTrigger>
                    <TabsTrigger value="terms" className="flex items-center gap-1.5 text-xs md:text-sm py-3">
                      <FileText className="h-4 w-4" />
                      <span className="hidden sm:inline">{t('terms')}</span>
                      <span className="sm:hidden">{locale === 'ar' ? 'شروط' : 'Terms'}</span>
                    </TabsTrigger>
                    <TabsTrigger value="privacy" className="flex items-center gap-1.5 text-xs md:text-sm py-3">
                      <Lock className="h-4 w-4" />
                      <span className="hidden sm:inline">{t('privacy')}</span>
                      <span className="sm:hidden">{locale === 'ar' ? 'خصوصية' : 'Privacy'}</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="booking" className="space-y-4">
                    <h3 className="text-xl font-bold text-gray-900">{t('booking')}</h3>
                    <p className="text-gray-600 leading-relaxed">{t('bookingText')}</p>
                  </TabsContent>

                  <TabsContent value="cancellation" className="space-y-4">
                    <h3 className="text-xl font-bold text-gray-900">{t('cancellation')}</h3>
                    <p className="text-gray-600 leading-relaxed">{t('cancellationText')}</p>
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mt-4">
                      <ul className="space-y-2 text-sm text-gray-700">
                        <li className="flex gap-2"><span>✓</span> {locale === 'ar' ? '7+ أيام قبل الرحلة: استرداد 100%' : '7+ days before: 100% refund'}</li>
                        <li className="flex gap-2"><span>✓</span> {locale === 'ar' ? '3-6 أيام: استرداد 50%' : '3-6 days before: 50% refund'}</li>
                        <li className="flex gap-2"><span>✗</span> {locale === 'ar' ? 'أقل من 48 ساعة: لا استرداد' : 'Less than 48h: No refund'}</li>
                      </ul>
                    </div>
                  </TabsContent>

                  <TabsContent value="terms" className="space-y-4">
                    <h3 className="text-xl font-bold text-gray-900">{t('terms')}</h3>
                    <div className="text-gray-600 leading-relaxed space-y-3">
                      <p>
                        {locale === 'ar'
                          ? 'بالحجز معنا، يوافق العميل على جميع الشروط والأحكام التالية:'
                          : 'By booking with us, the customer agrees to all following terms & conditions:'}
                      </p>
                      <ol className="list-decimal ps-6 space-y-2">
                        <li>{locale === 'ar' ? 'الحجز مؤكد فقط بعد دفع العربون (50%)' : 'Booking is confirmed only after deposit payment (50%)'}</li>
                        <li>{locale === 'ar' ? 'الأسعار قابلة للتغيير حسب الموسم والطلب' : 'Prices are subject to change based on season & demand'}</li>
                        <li>{locale === 'ar' ? 'الشركة غير مسؤولة عن الأغراض الشخصية المفقودة' : 'Company not responsible for lost personal belongings'}</li>
                        <li>{locale === 'ar' ? 'العميل مسؤول عن سلوكه الشخصي خلال الرحلة' : 'Customer is responsible for personal conduct during the trip'}</li>
                      </ol>
                    </div>
                  </TabsContent>

                  <TabsContent value="privacy" className="space-y-4">
                    <h3 className="text-xl font-bold text-gray-900">{t('privacy')}</h3>
                    <p className="text-gray-600 leading-relaxed">
                      {locale === 'ar'
                        ? 'نحترم خصوصيتك. كل البيانات اللي بنجمعها (الاسم، الموبايل، الإيميل) بتُستخدم فقط لغرض تأكيد الحجز والتواصل معك. مش بنشارك بياناتك مع أي طرف ثالث أبداً.'
                        : 'We respect your privacy. All data we collect (name, phone, email) is used only for booking confirmation and communication. We never share your data with any third party.'}
                    </p>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>
    </div>
  )
}