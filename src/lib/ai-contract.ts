import { z } from 'zod'

export const aiPageTypeSchema = z.enum([
  'home',
  'trips',
  'trip',
  'stays',
  'accommodation',
  'community',
  'article',
  'other',
])

export const aiChatRequestSchema = z.object({
  sessionId: z.string().uuid(),
  message: z.string().trim().min(1).max(1000),
  locale: z.enum(['ar', 'en']),
  page: z.object({
    url: z.string().trim().min(1).max(2048),
    type: aiPageTypeSchema,
    entityId: z.string().trim().regex(/^[A-Za-z0-9_-]{1,200}$/).optional(),
  }).strict(),
}).strict()

const internationalPhoneSchema = z.string()
  .trim()
  .transform(value => value.replace(/[\s().-]/g, ''))
  .refine(value => /^\+?[0-9]{7,15}$/.test(value), 'Invalid phone number')

export const aiLeadSchema = z.object({
  sessionId: z.string().uuid(),
  name: z.string().trim().min(2).max(120).transform(value => value.replace(/\s+/g, ' ')),
  whatsapp: internationalPhoneSchema,
  email: z.union([z.literal(''), z.string().trim().email().max(254)]).optional(),
  locale: z.enum(['ar', 'en']),
  initialPageUrl: z.string().trim().min(1).max(2048),
}).strict()

const aiActionSchema = z.object({
  type: z.enum(['view_trip', 'view_stay', 'open_whatsapp']),
  label: z.string().min(1).max(80),
  href: z.string().min(1).max(2048).refine(
    value => (value.startsWith('/') && !value.startsWith('//')) || value.startsWith('https://wa.me/'),
    'Invalid action URL',
  ),
}).strict()

export const aiUpstreamResponseSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  sessionId: z.string().uuid(),
  actions: z.array(aiActionSchema).max(4).optional().default([]),
}).strict()

export function parseAiUpstreamResponse(payload: unknown, expectedSessionId: string) {
  const parsed = aiUpstreamResponseSchema.safeParse(payload)
  if (!parsed.success || parsed.data.sessionId !== expectedSessionId) return null
  return parsed.data
}

export function sameOriginPath(value: string, origin: string) {
  try {
    const url = new URL(value, origin)
    if (url.origin !== origin) return null
    return `${url.pathname}${url.search}`.slice(0, 2048)
  } catch {
    return null
  }
}

export function isValidAiWebhookUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:'
      || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
  } catch {
    return false
  }
}

export function isAiFeatureEnabled(value: string | undefined) {
  return value === 'true'
}
