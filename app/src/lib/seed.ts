// Demo data generator. Runs once per SCHEMA_VERSION (see db.ts) and populates every
// collection with a realistic intercity-bus dataset so the product demos with no
// backend. Deterministic RNG => the demo looks identical on every load.

import { COLLECTIONS, genId, save, saveAll } from './db'
import { computeRecommendation, DEFAULT_PRICING_CONFIG } from './pricingEngine'
import type {
  Bus,
  BusType,
  CompetitorFare,
  DailyRevenueRecord,
  PriceHistoryEntry,
  Route,
  Trip
} from './types'

let _s = 20260923
function rnd() {
  _s = (_s * 1664525 + 1013904223) % 4294967296
  return _s / 4294967296
}
function pick<T>(a: T[]): T {
  return a[Math.floor(rnd() * a.length)]
}
function int(min: number, max: number) {
  return Math.floor(rnd() * (max - min + 1)) + min
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
function addDays(days: number, from?: string) {
  const d = from ? new Date(from) : new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const ROUTE_SEED: { origin: string; destination: string; distanceKm: number; durationHrs: number; popularity: number; basePrice: number }[] = [
  { origin: 'Mumbai', destination: 'Pune', distanceKm: 150, durationHrs: 3.5, popularity: 92, basePrice: 550 },
  { origin: 'Delhi', destination: 'Jaipur', distanceKm: 280, durationHrs: 5.5, popularity: 85, basePrice: 780 },
  { origin: 'Bengaluru', destination: 'Chennai', distanceKm: 350, durationHrs: 6.5, popularity: 80, basePrice: 950 },
  { origin: 'Hyderabad', destination: 'Vijayawada', distanceKm: 275, durationHrs: 5, popularity: 70, basePrice: 700 },
  { origin: 'Mumbai', destination: 'Goa', distanceKm: 590, durationHrs: 11, popularity: 88, basePrice: 1450 },
  { origin: 'Delhi', destination: 'Manali', distanceKm: 540, durationHrs: 13, popularity: 75, basePrice: 1600 },
  { origin: 'Pune', destination: 'Nashik', distanceKm: 210, durationHrs: 4.5, popularity: 58, basePrice: 620 },
  { origin: 'Chennai', destination: 'Pondicherry', distanceKm: 165, durationHrs: 3, popularity: 62, basePrice: 480 }
]

const BUS_TYPES: { type: BusType; label: string; seatMult: number; priceMult: number; times: string[] }[] = [
  { type: 'NON_AC_SEATER', label: 'Non-AC Seater', seatMult: 1.15, priceMult: 0.75, times: ['06:30', '14:00'] },
  { type: 'AC_SLEEPER', label: 'AC Sleeper', seatMult: 0.85, priceMult: 1.25, times: ['21:30', '22:45'] },
  { type: 'VOLVO_MULTI_AXLE', label: 'Volvo Multi-Axle', seatMult: 1.0, priceMult: 1.6, times: ['08:00', '20:00'] }
]

// Booking pace: fraction of seats filled given how far out we are and how popular
// the route is. Mirrors a typical S-curve — slow early, fast in the last week.
function bookingFraction(daysToDeparture: number, popularity: number, noise: number): number {
  const closeness = Math.max(0, Math.min(1, 1 - daysToDeparture / 21))
  const curve = Math.pow(closeness, 1.4)
  const popFactor = 0.35 + 0.65 * (popularity / 100)
  return Math.max(0, Math.min(0.99, curve * popFactor + noise))
}

const HOLIDAY_OFFSETS = [6, 13] // two festival-like departure dates inside the 21-day window

export function seedAll() {
  const routes: Route[] = ROUTE_SEED.map((r) => ({
    id: genId('route'),
    origin: r.origin,
    destination: r.destination,
    distanceKm: r.distanceKm,
    durationHrs: r.durationHrs,
    popularity: r.popularity
  }))

  const buses: Bus[] = []
  routes.forEach((route, ri) => {
    BUS_TYPES.forEach((bt) => {
      bt.times.forEach((time) => {
        buses.push({
          id: genId('bus'),
          routeId: route.id,
          type: bt.type,
          totalSeats: Math.round((ROUTE_SEED[ri].distanceKm > 400 ? 32 : 42) * bt.seatMult),
          departureTime: time
        })
      })
    })
  })

  const competitorFares: CompetitorFare[] = []
  routes.forEach((route, ri) => {
    const base = ROUTE_SEED[ri].basePrice
    const operators = ['IntrCity', 'RedBus Select', 'StateLine Roadways']
    operators.slice(0, 2).forEach((op) => {
      const variance = 0.85 + rnd() * 0.35
      competitorFares.push({ routeId: route.id, operatorName: op, price: Math.round((base * variance) / 10) * 10 })
    })
  })

  const trips: Trip[] = []
  const priceHistory: PriceHistoryEntry[] = []
  const today = todayISO()

  routes.forEach((route, ri) => {
    const base = ROUTE_SEED[ri].basePrice
    const routeBuses = buses.filter((b) => b.routeId === route.id)
    const compAvg =
      competitorFares.filter((c) => c.routeId === route.id).reduce((s, c) => s + c.price, 0) /
      Math.max(1, competitorFares.filter((c) => c.routeId === route.id).length)
    const btByType = Object.fromEntries(BUS_TYPES.map((b) => [b.type, b.priceMult]))

    for (let day = 0; day <= 21; day++) {
      const date = addDays(day, today)
      const isHoliday = HOLIDAY_OFFSETS.includes(day)

      routeBuses.forEach((bus) => {
        const basePrice = Math.round((base * btByType[bus.type]) / 10) * 10
        const noise = (rnd() - 0.5) * 0.12
        const fraction = bookingFraction(day, route.popularity + (isHoliday ? 15 : 0), noise)
        const bookedSeats = Math.min(bus.totalSeats, Math.round(bus.totalSeats * fraction))
        const occupancyPct = (bookedSeats / bus.totalSeats) * 100

        const rec = computeRecommendation(
          {
            occupancyPct,
            daysToDeparture: day,
            dateISO: date,
            isHoliday,
            basePrice,
            competitorAvg: compAvg,
            popularity: route.popularity
          },
          DEFAULT_PRICING_CONFIG
        )

        const autoApply = rnd() > 0.15
        const trip: Trip = {
          id: genId('trip'),
          routeId: route.id,
          busId: bus.id,
          date,
          totalSeats: bus.totalSeats,
          bookedSeats,
          basePrice,
          isHoliday,
          appliedPrice: autoApply ? rec.recommendedPrice : Math.round((basePrice * (0.95 + rnd() * 0.2)) / 10) * 10,
          autoApply
        }
        trips.push(trip)

        if (day <= 10) {
          // Checkpoints k days ago: back then this trip was (day + k) days from
          // departure, so replay the engine at that larger daysToDeparture to get
          // a believable price-history trail leading up to today's value.
          const checkpoints = [10, 7, 5, 3, 1, 0].filter((k) => k >= day)
          checkpoints.forEach((k) => {
            const daysOutAtCheckpoint = day + k
            const histFraction = bookingFraction(daysOutAtCheckpoint, route.popularity, (rnd() - 0.5) * 0.1)
            const histRec = computeRecommendation(
              {
                occupancyPct: Math.min(100, histFraction * 100),
                daysToDeparture: daysOutAtCheckpoint,
                dateISO: date,
                isHoliday,
                basePrice,
                competitorAvg: compAvg,
                popularity: route.popularity
              },
              DEFAULT_PRICING_CONFIG
            )
            priceHistory.push({
              tripId: trip.id,
              timestamp: addDays(-k, today),
              price: histRec.recommendedPrice,
              demandScore: histRec.demandScore
            })
          })
        }
      })
    }
  })

  const dailyRevenue: DailyRevenueRecord[] = []
  for (let k = 60; k >= 1; k--) {
    const date = addDays(-k, today)
    const seatsSold = int(180, 420)
    const avgDemandScore = int(38, 78)
    const avgFare = 700 + (avgDemandScore - 50) * 6 + int(-40, 40)
    const staticFare = 720
    const tripsCount = int(64, 78)
    const selfOccupancyPct = int(78, 104) // can exceed 100 briefly: overbooking on standing-room state permits
    const marketOccupancyPct = Math.max(45, Math.min(100, selfOccupancyPct - int(-8, 22)))
    const mainShare = 0.55 + rnd() * 0.15
    const mainSeats = Math.round(seatsSold * mainShare)
    const onlineShare = 0.88 + rnd() * 0.08
    const onlineBookings = Math.round(seatsSold * onlineShare)
    const advanceShare = 0.55 + rnd() * 0.2
    dailyRevenue.push({
      date,
      dynamicRevenue: Math.round(seatsSold * avgFare),
      staticRevenue: Math.round(seatsSold * staticFare * (0.9 + rnd() * 0.1)),
      seatsSold,
      avgDemandScore,
      tripsCount,
      routesOperated: ROUTE_SEED.length,
      selfOccupancyPct,
      marketOccupancyPct,
      mainSeats,
      viaSeats: seatsSold - mainSeats,
      onlineBookings,
      offlineBookings: seatsSold - onlineBookings,
      advanceBookings: Math.round(seatsSold * advanceShare),
      multiBookings: int(120, 210),
      postDepartureBookings: int(180, 340)
    })
  }

  saveAll(COLLECTIONS.routes, routes)
  saveAll(COLLECTIONS.buses, buses)
  saveAll(COLLECTIONS.trips, trips)
  saveAll(COLLECTIONS.competitorFares, competitorFares)
  saveAll(COLLECTIONS.priceHistory, priceHistory)
  saveAll(COLLECTIONS.dailyRevenue, dailyRevenue)
  save(COLLECTIONS.pricingConfig, DEFAULT_PRICING_CONFIG)
  save(COLLECTIONS.settings, { companyName: 'FareYield Transit Ops', currency: 'INR' })
}
