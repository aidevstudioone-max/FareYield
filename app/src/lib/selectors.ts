import { COLLECTIONS, getAll, load } from './db'
import { computeRecommendation } from './pricingEngine'
import type { Bus, CompetitorFare, DailyRevenueRecord, PriceHistoryEntry, PricingConfig, Route, Trip } from './types'
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

export function priceHistoryForTrip(tripId: string): PriceHistoryEntry[] {
  return getAll<PriceHistoryEntry>(COLLECTIONS.priceHistory)
    .filter((p) => p.tripId === tripId)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}
