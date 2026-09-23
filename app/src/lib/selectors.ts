import { COLLECTIONS, getAll, load, save, upsert } from './db'
import { computeRecommendation } from './pricingEngine'
import { generateSeatMap, type SeatInfo } from './seatMap'
import type { Bus, CompetitorFare, DailyRevenueRecord, PriceHistoryEntry, PricingConfig, Route, SeatLimits, SeatOverride, Trip } from './types'
import { DEFAULT_PRICING_CONFIG } from './pricingEngine'
import { daysBetween, todayISO } from './format'

export function getConfig(): PricingConfig {
  return load<PricingConfig>(COLLECTIONS.pricingConfig, DEFAULT_PRICING_CONFIG)
}

export function routeMap(): Record<string, Route> {
  return Object.fromEntries(getAll<Route>(COLLECTIONS.routes).map((r) => [r.id, r]))
}

export function busMap(): Record<string, Bus> {
  return Object.fromEntries(getAll<Bus>(COLLECTIONS.buses).map((b) => [b.id, b]))
}

export function competitorAvgForRoute(routeId: string): number {
  const fares = getAll<CompetitorFare>(COLLECTIONS.competitorFares).filter((c) => c.routeId === routeId)
  if (!fares.length) return 0
  return fares.reduce((s, f) => s + f.price, 0) / fares.length
}

export function tripDaysToDeparture(trip: Trip): number {
  return Math.max(0, daysBetween(todayISO(), trip.date))
}

export interface EnrichedTrip {
  trip: Trip
  route: Route
  bus: Bus
  occupancyPct: number
  daysToDeparture: number
}

export function enrichedTrips(): EnrichedTrip[] {
  const routes = routeMap()
  const buses = busMap()
  return getAll<Trip>(COLLECTIONS.trips)
    .map((trip) => {
      const route = routes[trip.routeId]
      const bus = buses[trip.busId]
      if (!route || !bus) return null
      return {
        trip,
        route,
        bus,
        occupancyPct: (trip.bookedSeats / trip.totalSeats) * 100,
        daysToDeparture: tripDaysToDeparture(trip)
      }
    })
    .filter((x): x is EnrichedTrip => x !== null)
    .sort((a, b) => a.daysToDeparture - b.daysToDeparture)
}

export function recommendationFor(e: EnrichedTrip, config: PricingConfig) {
  return computeRecommendation(
    {
      occupancyPct: e.occupancyPct,
      daysToDeparture: e.daysToDeparture,
      dateISO: e.trip.date,
      isHoliday: e.trip.isHoliday,
      basePrice: e.trip.basePrice,
      competitorAvg: competitorAvgForRoute(e.route.id),
      popularity: e.route.popularity
    },
    config
  )
}

export interface PriceAlert extends EnrichedTrip {
  recommendedPrice: number
  deltaPct: number
}

export function priceAlerts(config: PricingConfig, threshold = 8): PriceAlert[] {
  return enrichedTrips()
    .filter((e) => e.daysToDeparture <= 10)
    .map((e) => {
      const rec = recommendationFor(e, config)
      const deltaPct = ((rec.recommendedPrice - e.trip.appliedPrice) / e.trip.appliedPrice) * 100
      return { ...e, recommendedPrice: rec.recommendedPrice, deltaPct }
    })
    .filter((a) => Math.abs(a.deltaPct) >= threshold)
    .sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct))
}

export function dashboardKpis() {
  const daily = getAll<DailyRevenueRecord>(COLLECTIONS.dailyRevenue)
  const last30 = daily.slice(-30)
  const dynamicSum = last30.reduce((s, d) => s + d.dynamicRevenue, 0)
  const staticSum = last30.reduce((s, d) => s + d.staticRevenue, 0)
  const upliftPct = staticSum ? ((dynamicSum - staticSum) / staticSum) * 100 : 0

  const trips = enrichedTrips()
  const departingToday = trips.filter((t) => t.daysToDeparture === 0)
  const avgOccupancy = trips.length ? trips.reduce((s, t) => s + t.occupancyPct, 0) / trips.length : 0
  const avgDemand = last30.length ? last30.reduce((s, d) => s + d.avgDemandScore, 0) / last30.length : 0

  return {
    revenue30d: dynamicSum,
    upliftPct,
    departingToday: departingToday.length,
    avgOccupancy,
    avgDemand,
    seatsSoldYesterday: daily[daily.length - 1]?.seatsSold ?? 0
  }
}

export function revenueTrend(days = 14): DailyRevenueRecord[] {
  return getAll<DailyRevenueRecord>(COLLECTIONS.dailyRevenue).slice(-days)
}

export interface RoutePerformance {
  route: Route
  trips: number
  avgOccupancy: number
  avgUpliftPct: number
}

export function routePerformance(): RoutePerformance[] {
  const routes = getAll<Route>(COLLECTIONS.routes)
  const trips = enrichedTrips()
  return routes
    .map((route) => {
      const rTrips = trips.filter((t) => t.route.id === route.id)
      if (!rTrips.length) return { route, trips: 0, avgOccupancy: 0, avgUpliftPct: 0 }
      const avgOccupancy = rTrips.reduce((s, t) => s + t.occupancyPct, 0) / rTrips.length
      const avgUpliftPct =
        (rTrips.reduce((s, t) => s + (t.trip.appliedPrice - t.trip.basePrice) / t.trip.basePrice, 0) / rTrips.length) * 100
      return { route, trips: rTrips.length, avgOccupancy, avgUpliftPct }
    })
    .sort((a, b) => b.avgOccupancy - a.avgOccupancy)
}

export interface PastDayReport {
  date: string
  routesOperated: number
  tripsCount: number
  selfOccupancyPct: number
  marketOccupancyPct: number
}

export function pastDayReport(): PastDayReport | null {
  const daily = getAll<DailyRevenueRecord>(COLLECTIONS.dailyRevenue)
  const last = daily[daily.length - 1]
  if (!last) return null
  return {
    date: last.date,
    routesOperated: last.routesOperated,
    tripsCount: last.tripsCount,
    selfOccupancyPct: last.selfOccupancyPct,
    marketOccupancyPct: last.marketOccupancyPct
  }
}

export interface Past30DaysReport {
  from: string
  to: string
  revenue: number
  seatsSold: number
  asp: number
  occupancyPct: number
  mainPct: number
  viaPct: number
  onlineBookings: number
  offlineBookings: number
}

export function past30DaysReport(): Past30DaysReport | null {
  const daily = getAll<DailyRevenueRecord>(COLLECTIONS.dailyRevenue).slice(-30)
  if (!daily.length) return null
  const revenue = daily.reduce((s, d) => s + d.dynamicRevenue, 0)
  const seatsSold = daily.reduce((s, d) => s + d.seatsSold, 0)
  const mainSeats = daily.reduce((s, d) => s + d.mainSeats, 0)
  const viaSeats = daily.reduce((s, d) => s + d.viaSeats, 0)
  const onlineBookings = daily.reduce((s, d) => s + d.onlineBookings, 0)
  const offlineBookings = daily.reduce((s, d) => s + d.offlineBookings, 0)
  const occupancyPct = daily.reduce((s, d) => s + d.selfOccupancyPct, 0) / daily.length
  return {
    from: daily[0].date,
    to: daily[daily.length - 1].date,
    revenue,
    seatsSold,
    asp: seatsSold ? revenue / seatsSold : 0,
    occupancyPct,
    mainPct: mainSeats + viaSeats ? (mainSeats / (mainSeats + viaSeats)) * 100 : 0,
    viaPct: mainSeats + viaSeats ? (viaSeats / (mainSeats + viaSeats)) * 100 : 0,
    onlineBookings,
    offlineBookings
  }
}

export function earningsTrend(days = 30): DailyRevenueRecord[] {
  return getAll<DailyRevenueRecord>(COLLECTIONS.dailyRevenue).slice(-days)
}

// Compares the same weekday across recent weeks (e.g. every Tuesday for the
// last 6 weeks) rather than just the last N calendar days.
export function weekOnWeekRows(weeks = 6): DailyRevenueRecord[] {
  const daily = getAll<DailyRevenueRecord>(COLLECTIONS.dailyRevenue)
  if (!daily.length) return []
  const targetDow = new Date(daily[daily.length - 1].date).getDay()
  return daily
    .filter((d) => new Date(d.date).getDay() === targetDow)
    .slice(-weeks)
    .reverse()
}

export function seatMapForTrip(trip: Trip, bus: Bus): SeatInfo[] {
  return generateSeatMap(trip, bus)
}

export function seatOverridesForTrip(tripId: string): Record<string, number> {
  const prefix = `${tripId}:`
  return Object.fromEntries(
    getAll<SeatOverride>(COLLECTIONS.seatOverrides)
      .filter((o) => o.id.startsWith(prefix))
      .map((o) => [o.id.slice(prefix.length), o.price])
  )
}

export function setSeatOverride(tripId: string, seatId: string, price: number): void {
  upsert<SeatOverride>(COLLECTIONS.seatOverrides, { id: `${tripId}:${seatId}`, price })
}

export function clearSeatOverride(tripId: string, seatId: string): void {
  const key = `${tripId}:${seatId}`
  const items = getAll<SeatOverride>(COLLECTIONS.seatOverrides).filter((o) => o.id !== key)
  save(COLLECTIONS.seatOverrides, items)
}

const DEFAULT_SEAT_LIMITS: Omit<SeatLimits, 'id'> = {
  lower: null,
  upper: null,
  cutSeatDiscount: true,
  postDepartureDiscount: true,
  viaDiscountPct: 0
}

export function getSeatLimits(tripId: string): SeatLimits {
  const found = getAll<SeatLimits>(COLLECTIONS.seatLimits).find((l) => l.id === tripId)
  return found ?? { id: tripId, ...DEFAULT_SEAT_LIMITS }
}

export function saveSeatLimits(limits: SeatLimits): void {
  upsert<SeatLimits>(COLLECTIONS.seatLimits, limits)
}

// Applies manual overrides, bus-level floor/ceiling limits, and the two
// clearance-discount toggles (only for seats that aren't already booked) to
// get the final displayed price for one seat.
export function priceForSeat(seat: SeatInfo, overrides: Record<string, number>, limits: SeatLimits): number {
  let price = overrides[seat.id] ?? seat.basePrice
  if (!seat.isBooked) {
    if (limits.cutSeatDiscount) price *= 0.92
    if (limits.postDepartureDiscount) price *= 0.95
  }
  if (limits.lower != null) price = Math.max(limits.lower, price)
  if (limits.upper != null) price = Math.min(limits.upper, price)
  return Math.round(price / 5) * 5
}

export interface TripPerformance {
  occupancyPct: number
  revenue: number
  asp: number
}

export function currentTripPerformance(seats: SeatInfo[], overrides: Record<string, number>, limits: SeatLimits): TripPerformance {
  const booked = seats.filter((s) => s.isBooked)
  const revenue = booked.reduce((s, seat) => s + priceForSeat(seat, overrides, limits), 0)
  return {
    occupancyPct: seats.length ? (booked.length / seats.length) * 100 : 0,
    revenue,
    asp: booked.length ? revenue / booked.length : 0
  }
}

// Same-weekday-last-week comparison. There's no real historical trip to read
// (this bus/route/time didn't exist a week ago in the seed), so this is a
// deterministic estimate seeded off the trip id — consistent every time you
// open this trip, not re-randomized per render.
export function lastDowPerformance(trip: Trip): TripPerformance {
  let h = 0
  for (let i = 0; i < trip.id.length; i++) h = (h * 31 + trip.id.charCodeAt(i)) >>> 0
  const jitter = ((h % 1000) / 1000 - 0.5) * 24 // -12..+12 points
  const occupancyPct = Math.max(35, Math.min(100, (trip.bookedSeats / trip.totalSeats) * 100 + jitter))
  const seatsSold = Math.round((occupancyPct / 100) * trip.totalSeats)
  const asp = trip.basePrice * (0.95 + ((h >> 3) % 1000) / 1000 / 2)
  return { occupancyPct, revenue: Math.round(seatsSold * asp), asp }
}

export function priceHistoryForTrip(tripId: string): PriceHistoryEntry[] {
  return getAll<PriceHistoryEntry>(COLLECTIONS.priceHistory)
    .filter((p) => p.tripId === tripId)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}
