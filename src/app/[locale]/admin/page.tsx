'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { motion } from 'framer-motion'
import { LogIn, Lock, Mail } from 'lucide-react'

export default function AdminLoginPage() {
  const t = useTranslations('nav')
  const locale = useLocale()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    // Placeholder: In production, use Supabase auth
    // const { error } = await supabase.auth.signInWithPassword({ email, password })
    // if (error) setError(error.message)
    // else router.push(`/${locale}/admin/dashboard`)

    // For now, simulate login
    setTimeout(() => {
      setLoading(false)
      if (email && password.length >= 6) {
        window.location.href = `/${locale}/admin/dashboard`
      } else {
        setError(locale === 'ar' ? 'بيانات غير صحيحة' : 'Invalid credentials')
      }
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Card className="shadow-lg">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <div className="flex justify-center mb-4">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full border-[3px] border-[#38BDF8] bg-transparent" />
                  <div className="w-0 h-0 border-l-[13px] border-r-[13px] border-t-[18px] border-l-transparent border-r-transparent border-t-[#FB923C] -mt-[2px]" />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                <span className="text-brand-blue">FIRST</span>{' '}
                <span className="text-brand-orange">TRIP</span>
              </h1>
              <p className="text-sm text-gray-500 mt-2">
                {locale === 'ar' ? 'لوحة تحكم الإدارة' : 'Admin Dashboard'}
              </p>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4 text-center">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label htmlFor="email">
                  <Mail className="h-4 w-4 inline mr-1" />
                  {locale === 'ar' ? 'البريد الإلكتروني' : 'Email'}
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="admin@firsttrip-eg.com"
                  className="mt-1"
                  dir="ltr"
                />
              </div>
              <div>
                <Label htmlFor="password">
                  <Lock className="h-4 w-4 inline mr-1" />
                  {locale === 'ar' ? 'كلمة المرور' : 'Password'}
                </Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="mt-1"
                  dir="ltr"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-brand-blue hover:bg-brand-blue-dark"
                size="lg"
              >
                <LogIn className="h-4 w-4 mr-2" />
                {loading
                  ? (locale === 'ar' ? 'جاري الدخول...' : 'Signing in...')
                  : (locale === 'ar' ? 'تسجيل الدخول' : 'Sign In')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}