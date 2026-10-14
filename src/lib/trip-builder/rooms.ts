import type { RoomAllocationInput } from '@/lib/trip-requests/schema'

const CAPACITY = { single: 1, double: 2, triple: 3 } as const

export function roomCapacity(allocations: readonly RoomAllocationInput[] = []) {
  return allocations.reduce((sum, room) => sum + room.count * CAPACITY[room.type], 0)
}

/** Total number of ROOMS (sum of counts), not the number of allocation rows. */
export function roomCount(allocations: readonly RoomAllocationInput[] = []) {
  return allocations.reduce((sum, room) => sum + room.count, 0)
}

export function roomsFit(people: number, allocations: readonly RoomAllocationInput[] = []) {
  return roomCapacity(allocations) >= people
}

/** More rooms than guests can never be valid — every room needs at least one guest. */
export function roomsExceedPeople(people: number, allocations: readonly RoomAllocationInput[] = []) {
  return roomCount(allocations) > people
}

/** A customer-chosen allocation still works for this party size (capacity covers it, no empty rooms). */
export function roomsStillValid(people: number, allocations: readonly RoomAllocationInput[] = []) {
  return allocations.length > 0 && roomsFit(people, allocations) && !roomsExceedPeople(people, allocations)
}
