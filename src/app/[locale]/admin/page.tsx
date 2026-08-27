'use client'

import { useState } from 'react'
import { useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { motion } from 'framer-motion'
import { LogIn, Lock } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { useRouter } from '@/i18n/navigation'

export default function AdminLoginPage() {
  const locale = useLocale()
  const router = useRouter()
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
        router.replace('/admin/dashboard')
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
    <div className="min-h-screen bg-sand-100 flex items-center justify-center p-4 topo-bg">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <Card className="border-[1.5px] border-sand-300 shadow-none pin-card">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <div className="mb-5 flex justify-center">
                <Logo size="lg" priority />
              </div>
              <h1 className="font-display text-2xl font-extrabold text-sea-900">
                {locale === 'ar' ? 'مركز تحكم WEEMAP' : 'WEEMAP Business Control Center'}
              </h1>
              <p className="mt-2 text-sm text-sea-900/50">
                {locale === 'ar' ? 'دخول فريق الإدارة' : 'Team sign in'}
              </p>
            </div>

            {error && (
              <div role="alert" aria-live="polite" className="mb-4 rounded-lg bg-red-50 p-3 text-center text-sm text-red-600">
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
                  autoComplete="current-password"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-weemap-orange hover:bg-sun-600"
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
