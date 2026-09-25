import { roomsForPeople } from '@/lib/pricing'
import type { RoomAllocationInput } from '@/lib/trip-requests/schema'

export function suggestRooms(people: number): RoomAllocationInput[] {
  return [{ type: 'double', count: roomsForPeople('double', people) }]
}

export function roomCapacity(allocations: readonly RoomAllocationInput[] = []) {
  return allocations.reduce((sum, room) => {
    const capacity = room.type === 'single' ? 1 : room.type === 'double' ? 2 : 3
    return sum + room.count * capacity
  }, 0)
}

export function roomsFit(people: number, allocations: readonly RoomAllocationInput[] = []) {
  return roomCapacity(allocations) >= people
}
