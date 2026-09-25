// ─── /signature/build wizard logic — pure, client-safe ───
//
// The conversational brief at /signature/build posts to the SAME endpoint
// as the existing SignatureRequestForm (POST /api/experience-requests — see
// src/app/api/experience-requests/route.ts) with the SAME shape. This module
// owns the two decisions that make that safe to change independently of the
// step UI: which step is allowed to advance, and how the free-form draft
// collapses into that fixed request payload. Neither function touches the
// DOM, fetch, or i18n — see src/lib/signature-build.test.ts.

export const SIGNATURE_BUILD_STEPS = ['experience', 'travelers', 'when', 'vibe', 'contact'] as const
export type SignatureBuildStep = (typeof SIGNATURE_BUILD_STEPS)[number]

export type SignaturePace = 'relaxed' | 'balanced' | 'packed'
export type SignatureBudgetComfort = 'simple' | 'mid' | 'no_limit'

export interface SignatureBuildDraft {
  /** Free text: "what's the experience" — required, the one thing a brief cannot skip. */
  experienceIdea: string
  /** Vibe tags the visitor picked, e.g. "diving", "desert", "food" — vocabulary owned by the component/i18n layer, not this module. */
  vibes: string[]
  travelers: number
  /** Optional — birthday, honeymoon, reunion... folded into the request `notes`, never a separate DB column. */
  occasion: string
  dateMode: 'fixed' | 'flexible'
  /** YYYY-MM-DD. Only read when dateMode is 'fixed'. */
  preferredDate: string
  pace: SignaturePace | null
  budgetComfort: SignatureBudgetComfort | null
  fullName: string
  /** WhatsApp number — same field the existing SignatureRequestForm calls `phone`. */
  phone: string
  email: string
}

export const EMPTY_SIGNATURE_BUILD_DRAFT: SignatureBuildDraft = {
  experienceIdea: '',
  vibes: [],
  travelers: 2,
  occasion: '',
  dateMode: 'flexible',
  preferredDate: '',
  pace: null,
  budgetComfort: null,
  fullName: '',
  phone: '',
  email: '',
}

/**
 * Whether `step` has enough input to advance. Every earlier step must also
 * be valid — a visitor can't skip ahead by editing the URL/state directly —
 * enforced by `furthestReachableStep`, not repeated in every call site.
 */
export function isStepValid(step: SignatureBuildStep, draft: SignatureBuildDraft): boolean {
  switch (step) {
    case 'experience':
      return draft.experienceIdea.trim().length >= 5
    case 'travelers':
      return Number.isInteger(draft.travelers) && draft.travelers >= 1 && draft.travelers <= 50
    case 'when':
      return draft.dateMode === 'flexible' || /^\d{4}-\d{2}-\d{2}$/.test(draft.preferredDate)
    case 'vibe':
      // Vibe/pace/budget are all "tell us more" — never block the brief on taste.
      return true
    case 'contact':
      return draft.fullName.trim().length >= 3 && draft.phone.trim().length >= 10
  }
}

/** The last step a visitor may currently be on without leaving an earlier, invalid step behind. */
export function furthestReachableStep(draft: SignatureBuildDraft): SignatureBuildStep {
  let furthest: SignatureBuildStep = SIGNATURE_BUILD_STEPS[0]
  for (const step of SIGNATURE_BUILD_STEPS) {
    if (!isStepValid(step, draft)) break
    furthest = step
  }
  return furthest
}

export function isDraftSubmittable(draft: SignatureBuildDraft): boolean {
  return SIGNATURE_BUILD_STEPS.every((step) => isStepValid(step, draft))
}

/** The exact payload SignatureRequestForm's fetch already sends — see src/components/SignatureRequestForm.tsx — minus the honeypot/turnstile fields, which the component attaches itself. */
export interface SignatureRequestPayload {
  full_name: string
  phone: string
  email?: string
  preferred_date?: string
  spots_requested: number
  interests: string
  duration_preference: string
  notes: string
}

/**
 * Collapses the wizard draft into the one request shape the API accepts.
 * Nothing here invents data the visitor didn't provide: an empty vibe/pace/
 * budget/occasion simply contributes nothing to `notes`.
 */
export function buildSignatureRequestPayload(draft: SignatureBuildDraft): SignatureRequestPayload {
  const notesLines: string[] = []
  if (draft.occasion.trim()) notesLines.push(`Occasion: ${draft.occasion.trim()}`)
  if (draft.pace) notesLines.push(`Pace: ${draft.pace}`)
  if (draft.budgetComfort) notesLines.push(`Budget comfort: ${draft.budgetComfort}`)
  notesLines.push(draft.dateMode === 'flexible' ? 'Dates: flexible' : `Dates: ${draft.preferredDate}`)

  return {
    full_name: draft.fullName.trim(),
    phone: draft.phone.trim(),
    email: draft.email.trim() || undefined,
    preferred_date: draft.dateMode === 'fixed' && draft.preferredDate ? draft.preferredDate : undefined,
    spots_requested: draft.travelers,
    interests: [draft.experienceIdea.trim(), ...draft.vibes].filter(Boolean).join(' · '),
    duration_preference: '',
    notes: notesLines.join('\n'),
  }
}
