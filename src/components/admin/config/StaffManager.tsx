'use client'

// Owner-only staff management (docs/m3/OPS_API_CONTRACT.md — GET/POST /api/admin/staff,
// PATCH /api/admin/staff/:id). Staff are never deleted, only disabled, so their name
// keeps resolving in history and audit entries (src/lib/staff.ts).

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Plus, KeyRound, UserX, UserCheck, Dices } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStaff } from '@/components/admin/ops/StaffContext'
import { STAFF_ROLES, type StaffRole } from '@/lib/staff-policy'

interface StaffRow {
  id: string
  email: string
  display_name: string
  role: StaffRole
  is_active: boolean
  last_login_at: string | null
  created_at: string
}

function generatePassword(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%'
  const bytes = new Uint32Array(14)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 4294967295)
  return Array.from(bytes, (n) => alphabet[n % alphabet.length]).join('')
}

function errorMessage(t: ReturnType<typeof useTranslations>, code: string | undefined, fallback: string): string {
  if (code === 'last_owner') return t('errors.lastOwner')
  if (code === 'duplicate_email') return t('errors.duplicateEmail')
  if (code === 'weak_password') return t('errors.weakPassword')
  return fallback || t('errors.generic')
}

export function StaffManager() {
  const router = useRouter()
  const t = useTranslations('opsConfig.staff')
  const tCommon = useTranslations('opsConfig.common')
  const { capabilities } = useStaff()

  const [rows, setRows] = useState<StaffRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState({ email: '', display_name: '', role: 'operations' as StaffRole, password: '' })
  const [createSaving, setCreateSaving] = useState(false)
  const [createError, setCreateError] = useState('')

  const [resetTarget, setResetTarget] = useState<StaffRow | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetSaving, setResetSaving] = useState(false)
  const [resetError, setResetError] = useState('')

  const [toggleTarget, setToggleTarget] = useState<StaffRow | null>(null)
  const [toggleSaving, setToggleSaving] = useState(false)
  const [toggleError, setToggleError] = useState('')

  const [roleUpdatingId, setRoleUpdatingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const res = await fetch('/api/admin/staff')
      if (res.status === 401) { router.replace('/admin'); return }
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRows(data.staff || [])
    } catch {
      setLoadError(tCommon('loadError'))
    } finally {
      setLoading(false)
    }
  }, [tCommon, router])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off an async fetch
    load()
  }, [load])

  if (!capabilities.manageStaff) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-gray-500">{t('ownerOnlyNotice')}</CardContent>
      </Card>
    )
  }

  const submitCreate = async () => {
    setCreateError('')
    if (!createForm.email.trim() || !createForm.display_name.trim() || createForm.password.length < 10) {
      setCreateError(t('errors.weakPassword'))
      return
    }
    setCreateSaving(true)
    try {
      const res = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: createForm.email.trim(),
          display_name: createForm.display_name.trim(),
          role: createForm.role,
          password: createForm.password,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setCreateError(errorMessage(t, data.code, data.error)); return }
      setRows((prev) => [...prev, data.staff])
      setCreateOpen(false)
      setCreateForm({ email: '', display_name: '', role: 'operations', password: '' })
    } finally {
      setCreateSaving(false)
    }
  }

  const changeRole = async (row: StaffRow, role: StaffRole) => {
    if (role === row.role) return
    setRoleUpdatingId(row.id)
    try {
      const res = await fetch(`/api/admin/staff/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { window.alert(errorMessage(t, data.code, data.error)); return }
      setRows((prev) => prev.map((r) => (r.id === row.id ? data.staff : r)))
    } finally {
      setRoleUpdatingId(null)
    }
  }

  const submitReset = async () => {
    if (!resetTarget) return
    setResetError('')
    if (resetPassword.length < 10) { setResetError(t('errors.weakPassword')); return }
    setResetSaving(true)
    try {
      const res = await fetch(`/api/admin/staff/${resetTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: resetPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setResetError(errorMessage(t, data.code, data.error)); return }
      setResetTarget(null)
      setResetPassword('')
    } finally {
      setResetSaving(false)
    }
  }

  const submitToggle = async () => {
    if (!toggleTarget) return
    setToggleError('')
    setToggleSaving(true)
    try {
      const res = await fetch(`/api/admin/staff/${toggleTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !toggleTarget.is_active }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setToggleError(errorMessage(t, data.code, data.error)); return }
      setRows((prev) => prev.map((r) => (r.id === toggleTarget.id ? data.staff : r)))
      setToggleTarget(null)
    } finally {
      setToggleSaving(false)
    }
  }

  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : tCommon('never'))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{t('title')}</h2>
          <p className="text-sm text-gray-500">{t('subtitle')}</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          {t('addButton')}
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {(STAFF_ROLES).map((role) => (
          <div key={role} className="rounded-lg border border-gray-200 bg-gray-50/70 p-3">
            <div className="text-sm font-semibold text-gray-800">{t(`roles.${role}Name`)}</div>
            <div className="mt-0.5 text-xs text-gray-500">{t(`roles.${role}Desc`)}</div>
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">{t('table.name')}</TableHead>
                <TableHead scope="col">{t('table.email')}</TableHead>
                <TableHead scope="col">{t('table.role')}</TableHead>
                <TableHead scope="col">{t('table.status')}</TableHead>
                <TableHead scope="col">{t('table.lastSignIn')}</TableHead>
                <TableHead scope="col">{t('table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-gray-400">
                  <Loader2 className="mr-2 inline h-5 w-5 animate-spin" />{tCommon('loading')}
                </TableCell></TableRow>
              )}
              {!loading && loadError && (
                <TableRow><TableCell colSpan={6} className="py-8 text-center text-red-500">{loadError}</TableCell></TableRow>
              )}
              {!loading && !loadError && rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.display_name}</TableCell>
                  <TableCell dir="ltr" className="text-gray-500">{row.email}</TableCell>
                  <TableCell>
                    <Select
                      value={row.role}
                      onValueChange={(v) => v && changeRole(row, v as StaffRole)}
                      disabled={roleUpdatingId === row.id}
                    >
                      <SelectTrigger className="h-8 w-[130px] text-xs" aria-label={t('editRole.label')}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STAFF_ROLES.map((role) => (
                          <SelectItem key={role} value={role}>{t(`roles.${role}Name`)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.is_active ? 'default' : 'outline'} className={cn(!row.is_active && 'text-gray-500')}>
                      {row.is_active ? t('statusActive') : t('statusDisabled')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-gray-500">{fmt(row.last_login_at)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => { setResetTarget(row); setResetPassword(''); setResetError('') }}
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                        {t('resetPassword.button')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn('gap-1.5', row.is_active ? 'text-red-500 hover:bg-red-50 hover:text-red-700' : 'text-green-600 hover:bg-green-50')}
                        onClick={() => { setToggleTarget(row); setToggleError('') }}
                      >
                        {row.is_active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                        {row.is_active ? t('disable.button') : t('enable.button')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) setCreateError('') }}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle>{t('create.title')}</DialogTitle>
          <div className="space-y-3">
            <div>
              <Label htmlFor="staff-create-email">{t('create.emailLabel')}</Label>
              <Input
                id="staff-create-email" dir="ltr" type="email" className="mt-1"
                value={createForm.email}
                onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="staff-create-name">{t('create.nameLabel')}</Label>
              <Input
                id="staff-create-name" className="mt-1"
                value={createForm.display_name}
                onChange={(e) => setCreateForm((f) => ({ ...f, display_name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="staff-create-role">{t('create.roleLabel')}</Label>
              <Select value={createForm.role} onValueChange={(v) => v && setCreateForm((f) => ({ ...f, role: v as StaffRole }))}>
                <SelectTrigger id="staff-create-role" className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAFF_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>{t(`roles.${role}Name`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="staff-create-password">{t('create.passwordLabel')}</Label>
              <div className="mt-1 flex gap-2">
                <Input
                  id="staff-create-password" dir="ltr" className="flex-1"
                  value={createForm.password}
                  onChange={(e) => setCreateForm((f) => ({ ...f, password: e.target.value }))}
                />
                <Button
                  type="button" variant="outline" size="icon"
                  aria-label={t('create.generatePassword')}
                  title={t('create.generatePassword')}
                  onClick={() => setCreateForm((f) => ({ ...f, password: generatePassword() }))}
                >
                  <Dices className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-1 text-xs text-gray-500">{t('create.passwordHint')}</p>
            </div>
            {createError && <p className="text-sm text-red-600">{createError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{tCommon('cancel')}</Button>
            <Button onClick={submitCreate} disabled={createSaving} className="gap-1.5">
              {createSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('create.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={Boolean(resetTarget)} onOpenChange={(open) => !open && setResetTarget(null)}>
        <DialogContent className="sm:max-w-md">
          {resetTarget && (
            <>
              <DialogTitle>{t('resetPassword.title', { name: resetTarget.display_name })}</DialogTitle>
              <DialogDescription>{t('resetPassword.notice')}</DialogDescription>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="staff-reset-password">{t('resetPassword.passwordLabel')}</Label>
                  <div className="mt-1 flex gap-2">
                    <Input
                      id="staff-reset-password" dir="ltr" className="flex-1"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                    />
                    <Button
                      type="button" variant="outline" size="icon"
                      aria-label={t('resetPassword.generatePassword')}
                      title={t('resetPassword.generatePassword')}
                      onClick={() => setResetPassword(generatePassword())}
                    >
                      <Dices className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {resetError && <p className="text-sm text-red-600">{resetError}</p>}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setResetTarget(null)}>{tCommon('cancel')}</Button>
                <Button onClick={submitReset} disabled={resetSaving} className="gap-1.5">
                  {resetSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('resetPassword.submit')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Disable / re-enable confirmation */}
      <Dialog open={Boolean(toggleTarget)} onOpenChange={(open) => !open && setToggleTarget(null)}>
        <DialogContent className="sm:max-w-md">
          {toggleTarget && (
            <>
              <DialogTitle>
                {toggleTarget.is_active
                  ? t('disable.title', { name: toggleTarget.display_name })
                  : t('enable.title', { name: toggleTarget.display_name })}
              </DialogTitle>
              <DialogDescription>
                {toggleTarget.is_active ? t('disable.body') : t('enable.body')}
              </DialogDescription>
              {toggleError && <p className="text-sm text-red-600">{toggleError}</p>}
              <DialogFooter>
                <Button variant="outline" onClick={() => setToggleTarget(null)}>{tCommon('cancel')}</Button>
                <Button
                  onClick={submitToggle}
                  disabled={toggleSaving}
                  className={cn('gap-1.5', toggleTarget.is_active && 'bg-red-600 text-white hover:bg-red-700')}
                >
                  {toggleSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                  {toggleTarget.is_active ? t('disable.confirm') : t('enable.confirm')}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
