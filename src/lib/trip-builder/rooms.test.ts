import assert from 'node:assert/strict'
import test from 'node:test'
import { roomCapacity, roomCount, roomsExceedPeople, roomsFit, roomsStillValid } from './rooms'

test('roomCount sums room counts across allocation rows', () => {
  assert.equal(roomCount([]), 0)
  assert.equal(roomCount([{ type: 'double', count: 2 }, { type: 'single', count: 1 }]), 3)
  assert.equal(roomCapacity([{ type: 'double', count: 2 }, { type: 'triple', count: 1 }]), 7)
})

test('a custom allocation is valid only when it fits and has no empty rooms', () => {
  const triple = [{ type: 'triple' as const, count: 1 }]
  assert.equal(roomsFit(3, triple), true)
  assert.equal(roomsStillValid(3, triple), true)
  assert.equal(roomsStillValid(4, triple), false)
  assert.equal(roomsExceedPeople(2, [{ type: 'single', count: 3 }]), true)
  assert.equal(roomsStillValid(2, [{ type: 'single', count: 3 }]), false)
  assert.equal(roomsStillValid(2, []), false)
})
