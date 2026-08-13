'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { motion } from 'framer-motion'
import { LogIn, Lock } from 'lucide-react'
import Image from 'next/image'

export default function AdminLoginPage() {
  const locale = useLocale()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const password = formData.get('password') as string

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        window.location.href = `/${locale}/admin/dashboard`
        return
      }
      setError(data.error || (locale === 'ar' ? 'بيانات غير صحيحة' : 'Invalid credentials'))
    } catch {
      setError(locale === 'ar' ? 'حدث خطأ، حاول مرة أخرى' : 'Something went wrong, try again')
    } finally {
      setLoading(false)
    }
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
                <Image src="/logo.png" alt="First Trip" width={56} height={56} className="w-14 h-auto" />
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
                  autoFocus
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
