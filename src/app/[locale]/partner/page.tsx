'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { motion } from 'framer-motion'
import { Handshake, Users, TrendingUp, Megaphone, CheckCircle2, Send } from 'lucide-react'

const benefits = [
  { icon: Users, key: 'benefit1' },
  { icon: TrendingUp, key: 'benefit2' },
  { icon: Megaphone, key: 'benefit3' },
  { icon: CheckCircle2, key: 'benefit4' },
] as const

export default function PartnerPage() {
  const t = useTranslations('partner')
  const [submitted, setSubmitted] = useState(false)

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-brand-orange to-brand-orange-dark text-white py-20 md:py-28 text-center">
        <div className="container-main">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Handshake className="h-12 w-12 mx-auto mb-4 opacity-90" />
            <h1 className="text-4xl md:text-5xl font-extrabold mb-3">{t('title')}</h1>
            <p className="text-lg text-orange-100 max-w-2xl mx-auto">{t('subtitle')}</p>
          </motion.div>
        </div>
      </section>

      {/* Benefits */}
      <section className="section-padding bg-white">
        <div className="container-main">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-12">
            {t('benefits')}
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((b, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center p-6 rounded-2xl bg-orange-50/40 border border-orange-100"
              >
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-brand-orange text-white flex items-center justify-center">
                  <b.icon className="h-6 w-6" />
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{t(b.key)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section className="section-padding bg-gray-50">
        <div className="container-main max-w-2xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Card>
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
                  {t('contactForm')}
                </h2>

                {submitted ? (
                  <div className="text-center py-10">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                      <CheckCircle2 className="h-8 w-8 text-green-600" />
                    </div>
                    <p className="text-lg text-gray-700">{t('success')}</p>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => { e.preventDefault(); setSubmitted(true) }}
                    className="space-y-4"
                  >
                    <div>
                      <Label htmlFor="name">{t('name')}</Label>
                      <Input id="name" required className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="business">{t('business')}</Label>
                      <Input id="business" required className="mt-1" />
                    </div>
                    <div>
                      <Label htmlFor="phone">{t('phone')}</Label>
                      <Input id="phone" type="tel" required className="mt-1" dir="ltr" />
                    </div>
                    <div>
                      <Label htmlFor="message">{t('message')}</Label>
                      <Textarea id="message" rows={4} className="mt-1" />
                    </div>
                    <Button type="submit" className="w-full bg-brand-orange hover:bg-brand-orange-dark" size="lg">
                      <Send className="h-4 w-4 mr-2" />
                      {t('send')}
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </section>
    </div>
  )
}