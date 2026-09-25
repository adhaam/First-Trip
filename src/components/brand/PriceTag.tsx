'use client'

import { useTranslations } from 'next-intl'
import { Price } from '@/components/Price'

const UNIT_KEY = {
  person: 'unitPerson',
  night: 'unitNight',
  room: 'unitRoom',
  trip: 'unitTrip',
} as const

/**
 * The brand-primitive face of `<Price>` — same formatting engine
 * (`formatAmount` in `lib/format.ts`, so numerals and rounding never
 * diverge from anywhere else a price renders), with the unit spelled out
 * as a closed enum instead of a free-text string, so every card gets one
 * of the four unit phrases WEEMAP actually uses.
 */
export function PriceTag({
  amount,
  from = false,
  unit,
  size = 'md',
  tone = 'ink',
  className,
}: {
  amount: number
  /** Prefixes the amount with "From" / "يبدأ من". */
  from?: boolean
  unit?: keyof typeof UNIT_KEY
  size?: 'sm' | 'md' | 'lg'
  tone?: 'ink' | 'light'
  className?: string
}) {
  const ui = useTranslations('ui')
  return (
    <Price
      amount={amount}
      label={from ? ui('priceFrom') : undefined}
      unit={unit ? ui(UNIT_KEY[unit]) : undefined}
      size={size}
      tone={tone}
      className={className}
    />
  )
}
