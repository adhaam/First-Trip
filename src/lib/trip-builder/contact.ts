/**
 * Maps `contactSchema` validation failures to the message key the Contact
 * step should show under each field — pure so the mapping is testable
 * without mounting the form. Never re-implements the validation rules
 * themselves (min lengths, email shape, …); those stay owned by
 * `contactSchema` in `src/lib/trip-requests/schema.ts`.
 */
import { contactSchema } from '@/lib/trip-requests/schema'

export type ContactFieldErrors = { name?: string; phone?: string; email?: string }

const FIELD_KEY = { name: 'errorName', phone: 'errorPhone', email: 'errorEmail' } as const

export function contactErrors(contact: { name?: string; phone?: string; email?: string }): ContactFieldErrors {
  const result = contactSchema.safeParse(contact)
  if (result.success) return {}

  const errors: ContactFieldErrors = {}
  for (const issue of result.error.issues) {
    const field = issue.path[0]
    if (field === 'name' || field === 'phone' || field === 'email') errors[field] ??= FIELD_KEY[field]
  }
  return errors
}
