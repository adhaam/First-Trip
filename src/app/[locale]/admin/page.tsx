'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { motion } from 'framer-motion'
import { LogIn, Lock, Mail } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { useRouter } from '@/i18n/navigation'

export default function AdminLoginPage() {
  const t = useTranslations('ops.login')
  const router = useRouter()
  const [useShared, setUseShared] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const password = formData.get('password') as string
    const email = useShared ? undefined : (formData.get('email') as string)

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(email ? { email, password } : { password }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        router.replace('/admin/dashboard')
        return
      }
      if (data.code === 'email_required') {
        setUseShared(false)
        setError(t('emailRequired'))
      } else {
        setError(t('invalidCredentials'))
      }
    } catch {
      setError(t('genericError'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="topo-bg flex min-h-screen items-center justify-center bg-sand-100 p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Card className="pin-card border-[1.5px] border-sand-300 shadow-none">
          <CardContent className="p-8">
            <div className="mb-8 text-center">
              <div className="mb-5 flex justify-center"><Logo size="lg" priority /></div>
              <h1 className="font-display text-2xl font-extrabold text-sea-900">{t('title')}</h1>
              <p className="mt-2 text-sm text-sea-900/50">{t('subtitle')}</p>
            </div>

            {error && (
              <div role="alert" aria-live="polite" className="mb-4 rounded-lg bg-red-50 p-3 text-center text-sm text-red-600">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {!useShared && (
                <div>
                  <Label htmlFor="email"><Mail className="me-1 inline h-4 w-4" />{t('email')}</Label>
                  <Input id="email" name="email" type="email" required={!useShared} className="mt-1" dir="ltr" autoComplete="username" />
                </div>
              )}
              <div>
                <Label htmlFor="password"><Lock className="me-1 inline h-4 w-4" />{useShared ? t('sharedPasswordLabel') : t('password')}</Label>
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
              <Button type="submit" disabled={loading} className="w-full bg-weemap-orange hover:bg-sun-600" size="lg">
                <LogIn className="me-2 h-4 w-4" />
                {loading ? t('signingIn') : t('signIn')}
              </Button>
            </form>

            <button
              type="button"
              onClick={() => { setUseShared((v) => !v); setError('') }}
              className="mt-4 w-full text-center text-xs text-sea-900/60 underline-offset-2 hover:underline"
            >
              {useShared ? t('useEmailPassword') : t('useSharedPassword')}
            </button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
