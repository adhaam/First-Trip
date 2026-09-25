'use client'

import { createContext, useContext } from 'react'
import type { StaffRole } from '@/lib/staff-policy'

export type SignedInStaff = {
  id: string | null
  email: string | null
  display_name: string
  role: StaffRole
  legacy: boolean
}

export type StaffCapabilities = { manageCatalogue: boolean; manageStaff: boolean }

export type StaffContextValue = { staff: SignedInStaff | null; capabilities: StaffCapabilities }

const NO_CAPABILITIES: StaffCapabilities = { manageCatalogue: false, manageStaff: false }

export const StaffContext = createContext<StaffContextValue>({ staff: null, capabilities: NO_CAPABILITIES })

/** Who is signed in (from GET /api/admin/me). UI hints only — the API enforces every permission. */
export function useStaff(): StaffContextValue {
  return useContext(StaffContext)
}
