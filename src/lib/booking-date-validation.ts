import { nightsForDuration } from '@/lib/pricing'
import type { BookingInput } from '@/lib/public-booking'
import { checkServiceDate, resolveStayPattern, type TransportScheduleConfig } from '@/lib/transport/schedule'

export type BookingDateValidationResult =
  | { ok: true; input: BookingInput }
  | { ok: false; code: string; error: string }

function invalidDate(code: string, error: string): BookingDateValidationResult {
  return { ok: false, code, error }
}

function serviceDateError(
  direction: 'outbound' | 'return',
  reason: string,
): BookingDateValidationResult {
  const label = direction === 'outbound' ? 'departure' : 'return'
  const reasonText = reason === 'blackout' ? ' because it is unavailable' : ''
  return invalidDate(
    `TRANSFER_${direction.toUpperCase()}_UNAVAILABLE`,
    `The selected ${label} date is not available for this transfer${reasonText}.`,
  )
}

function packagePatternCode(
  transferType: NonNullable<BookingInput['transfer_type']>,
  duration: BookingInput['duration'],
): string | null {
  if (duration !== 4 && duration !== 5) {
    return null
  }

  const prefix = transferType === 'package_bus' ? 'bus' : 'hiace'
  return `${prefix}_${duration}d${duration - 1}n`
}

/**
 * Pure, authoritative transport-date validation for public bookings. Package
 * return dates are derived from the commercial stay pattern, never trusted
 * from the browser.
 */
export function validateBookingDates(
  input: BookingInput,
  schedule: TransportScheduleConfig,
): BookingDateValidationResult {
  if (input.booking_type === 'accommodation-only') {
    return { ok: true, input }
  }

  if (!input.trip_date || !input.transfer_type) {
    return invalidDate('TRANSFER_DATE_REQUIRED', 'A transfer date and transport mode are required.')
  }

  try {
    if (input.booking_type === 'package') {
      const duration = input.duration
      if (duration !== 4 && duration !== 5) {
        return invalidDate('PACKAGE_DURATION_INVALID', 'A package duration of 4 or 5 days is required.')
      }

      const patternCode = packagePatternCode(input.transfer_type, duration)
      if (!patternCode) {
        return invalidDate('PACKAGE_DURATION_INVALID', 'A package duration of 4 or 5 days is required.')
      }

      const pattern = resolveStayPattern(schedule, {
        patternCode,
        transferType: input.transfer_type,
        outboundDate: input.trip_date,
        originCode: input.governorate,
      })
      if (!pattern.ok) {
        return invalidDate(
          'PACKAGE_STAY_PATTERN_UNAVAILABLE',
          'The selected departure date is unavailable for this package.',
        )
      }

      if (nightsForDuration(duration) !== pattern.nights) {
        return invalidDate(
          'PACKAGE_NIGHTS_MISMATCH',
          'The configured package stay pattern does not match package pricing.',
        )
      }

      if (input.return_date && input.return_date !== pattern.returnDate) {
        return invalidDate(
          'PACKAGE_RETURN_DATE_MISMATCH',
          'The selected return date does not match the package schedule.',
        )
      }

      return {
        ok: true,
        input: {
          ...input,
          return_date: pattern.returnDate,
        },
      }
    }

    const direction = input.transfer_direction ?? 'to_dahab'
    const outboundRequired = direction === 'to_dahab' || direction === 'round_trip'

    if (outboundRequired) {
      const outbound = checkServiceDate(schedule, {
        transferType: input.transfer_type,
        direction: 'outbound',
        date: input.trip_date,
        originCode: input.governorate,
      })
      if (!outbound.ok) {
        return serviceDateError('outbound', outbound.reason)
      }
    } else {
      const returnService = checkServiceDate(schedule, {
        transferType: input.transfer_type,
        direction: 'return',
        date: input.trip_date,
        originCode: input.governorate,
      })
      if (!returnService.ok) {
        return serviceDateError('return', returnService.reason)
      }
    }

    if (direction !== 'round_trip') {
      return { ok: true, input }
    }

    if (!input.return_date) {
      return invalidDate('TRANSFER_RETURN_DATE_REQUIRED', 'A return date is required for a round trip.')
    }
    if (input.return_date < input.trip_date) {
      return invalidDate('TRANSFER_RETURN_DATE_BEFORE_DEPARTURE', 'Return date cannot be before the departure date.')
    }

    const returnService = checkServiceDate(schedule, {
      transferType: input.transfer_type,
      direction: 'return',
      date: input.return_date,
      originCode: input.governorate,
    })
    if (!returnService.ok) {
      return serviceDateError('return', returnService.reason)
    }

    return { ok: true, input }
  } catch {
    return invalidDate('TRANSFER_DATE_INVALID', 'A valid transfer date is required.')
  }
}
