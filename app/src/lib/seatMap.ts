import type { Bus, Trip } from './types'

export interface SeatInfo {
  id: string
  deck: 'LOWER' | 'UPPER' | 'SEATER'
  row: number
  col: string
  isBooked: boolean
  basePrice: number
}

function hashSeed(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h || 1
}

function makeRng(seed: number) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296
    return s / 4294967296
  }
}

const SLEEPER_COLS = ['A', 'B', 'C', 'E', 'F', 'G']
const SEATER_COLS = ['A', 'B', 'C', 'D']

function seatMultiplier(seatId: string, deck: SeatInfo['deck'], col: string): number {
  const jitter = (hashSeed(seatId) % 1000) / 1000 - 0.5 // -0.5..0.5, deterministic per seat
  let m = jitter * 0.1 // ±5% natural variation, same seat always prices the same
  if (deck === 'LOWER') m += 0.08 // lower berths command a premium
  if (deck === 'UPPER') m -= 0.05
  const cols = deck === 'SEATER' ? SEATER_COLS : SLEEPER_COLS
  if (col === cols[0] || col === cols[cols.length - 1]) m += 0.05 // window seat
  return m
}

// Deterministic per-trip seat layout: same trip always renders the same map
// (same booked seats, same per-seat prices) without needing to persist it —
// only manual overrides get saved separately.
export function generateSeatMap(trip: Trip, bus: Bus): SeatInfo[] {
  const isSleeper = bus.type === 'AC_SLEEPER'
  const cols = isSleeper ? SLEEPER_COLS : SEATER_COLS
  const perRow = cols.length
  const totalSeats = trip.totalSeats
  const rows = Math.ceil(totalSeats / perRow)
  const lowerRows = isSleeper ? Math.ceil(rows / 2) : rows

  const rng = makeRng(hashSeed(trip.id))
  const order = Array.from({ length: totalSeats }, (_, i) => i)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  const bookedIndex = new Set(order.slice(0, trip.bookedSeats))

  const seats: SeatInfo[] = []
  let idx = 0
  for (let r = 1; r <= rows && idx < totalSeats; r++) {
    const deck: SeatInfo['deck'] = isSleeper ? (r <= lowerRows ? 'LOWER' : 'UPPER') : 'SEATER'
    for (let c = 0; c < perRow && idx < totalSeats; c++) {
      const col = cols[c]
      const id = `${col}${r}`
      const multiplier = seatMultiplier(id, deck, col)
      seats.push({
        id,
        deck,
        row: r,
        col,
        isBooked: bookedIndex.has(idx),
        basePrice: Math.round((trip.appliedPrice * (1 + multiplier)) / 10) * 10
      })
      idx++
    }
  }
  return seats
}
