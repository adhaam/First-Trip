import type { BookingInput } from '@/lib/public-booking'
import { checkServiceDate, findStayPattern, resolveStayPattern, type TransportScheduleConfig } from '@/lib/transport/schedule'

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
      const stayPattern = duration == null
        ? null
        : findStayPattern(schedule, {
          transferType: input.transfer_type,
          durationDays: duration,
        })
      if (!stayPattern) {
        return invalidDate(
          'PACKAGE_STAY_PATTERN_UNAVAILABLE',
          'The selected departure date is unavailable for this package.',
        )
      }

      const pattern = resolveStayPattern(schedule, {
        patternCode: stayPattern.code,
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
          duration: pattern.durationDays,
          nights: pattern.nights,
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
