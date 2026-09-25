'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { useRouter } from '@/i18n/navigation'
import { useOpsFetch } from '@/components/admin/ops/useOpsFetch'
import { useStaff } from '@/components/admin/ops/StaffContext'

export function MyAccountView() {
  const t = useTranslations('ops.account')
  const tRole = useTranslations('ops.role')
  const fetchJson = useOpsFetch()
  const router = useRouter()
  const { staff } = useStaff()

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [success, setSuccess] = useState(false)

  const legacy = staff?.legacy === true

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    if (next !== confirm) { setMessage(t('mismatch')); return }
    setSubmitting(true)
    try {
      await fetchJson('/api/admin/me', {
        method: 'PATCH',
        body: JSON.stringify({ current_password: current, new_password: next }),
      })
      setSuccess(true)
      setMessage(t('success'))
      setTimeout(async () => {
        await fetch('/api/admin/logout', { method: 'POST' })
        router.replace('/admin')
      }, 1500)
    } catch (err) {
      const code = err instanceof Error ? (err as Error & { code?: string }).code : undefined
      const tErr = t
      setMessage(code && ['invalid_credentials', 'weak_password', 'legacy'].includes(code) ? tErr(`errors.${code}`) : tErr('errors.generic'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex max-w-lg flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">{t('title')}</h1>
        {staff && (
          <p className="mt-1 text-sm text-muted-foreground">
            {t('signedInAs')}: {staff.display_name} · {t('role')}: {tRole(staff.role)}
          </p>
        )}
      </div>

      {legacy ? (
        <Card><CardContent className="p-4 text-sm text-amber-800">{t('legacyNotice')}</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-gray-900">{t('changePassword')}</h2>
            {message && (
              <p role="alert" className={`mb-3 rounded-md p-2 text-sm ${success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{message}</p>
            )}
            <form onSubmit={submit} className="flex flex-col gap-3">
              <div>
                <Label htmlFor="current-password">{t('currentPassword')}</Label>
                <Input id="current-password" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className="mt-1" required autoComplete="current-password" />
              </div>
              <div>
                <Label htmlFor="new-password">{t('newPassword')}</Label>
                <Input id="new-password" type="password" value={next} onChange={(e) => setNext(e.target.value)} className="mt-1" required autoComplete="new-password" />
              </div>
              <div>
                <Label htmlFor="confirm-password">{t('confirmPassword')}</Label>
                <Input id="confirm-password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1" required autoComplete="new-password" />
              </div>
              <Button type="submit" disabled={submitting} className="mt-1">
                {submitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {submitting ? t('submitting') : t('submit')}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
