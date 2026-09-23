export type BusType = 'AC_SLEEPER' | 'NON_AC_SEATER' | 'VOLVO_MULTI_AXLE'

export interface Route {
  id: string
  origin: string
  destination: string
  distanceKm: number
  durationHrs: number
  popularity: number // 0-100, drives baseline demand
}

export interface Bus {
  id: string
  routeId: string
  type: BusType
  totalSeats: number
  departureTime: string // "HH:MM"
}

export interface Trip {
  id: string
  routeId: string
  busId: string
  date: string // ISO date of departure
  totalSeats: number
  bookedSeats: number
  basePrice: number
  isHoliday: boolean
  appliedPrice: number // price currently shown to customers
  autoApply: boolean // whether the engine's recommendation is auto-applied
}

export interface PriceFactors {
  occupancy: number // contribution, can be +/-
  urgency: number
  dayType: number
  competitor: number
  seasonality: number
}

export interface PriceRecommendation {
  demandScore: number // 0-100
  recommendedPrice: number
  multiplier: number
  factors: PriceFactors
  reasoning: string[]
}

export interface CompetitorFare {
  routeId: string
  operatorName: string
  price: number
}

export interface PricingConfig {
  algorithmMode: 'RULE_BASED' | 'ML_BLEND' | 'HYBRID'
  floorMultiplier: number // e.g. 0.75 => never price below 75% of base
  ceilingMultiplier: number // e.g. 1.9 => never price above 190% of base
  elasticity: number // 0.5 - 3, how aggressively price reacts to demand score
  weights: {
    occupancy: number
    urgency: number
    dayType: number
    competitor: number
    seasonality: number
  }
}

export interface DailyRevenueRecord {
  date: string
  dynamicRevenue: number
  staticRevenue: number
  seatsSold: number
  avgDemandScore: number
  tripsCount: number
  routesOperated: number
  selfOccupancyPct: number
  marketOccupancyPct: number // estimated competitor/market-wide occupancy, for benchmarking
  mainSeats: number // seats sold on the direct/main route
  viaSeats: number // seats sold on connecting/via legs
  onlineBookings: number
  offlineBookings: number
  advanceBookings: number // booked more than 3 days out
  multiBookings: number // bookings of 2+ seats in one transaction
  postDepartureBookings: number // boarded at an intermediate stop after departure
}

export interface SeatOverride {
  id: string // `${tripId}:${seatId}`
  price: number
}

export interface SeatLimits {
  id: string // tripId
  lower: number | null
  upper: number | null
  cutSeatDiscount: boolean
  postDepartureDiscount: boolean
  viaDiscountPct: number
}

export interface PriceHistoryEntry {
  tripId: string
  timestamp: string
  price: number
  demandScore: number
}
