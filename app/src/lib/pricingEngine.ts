import type { PriceFactors, PriceRecommendation, PricingConfig } from './types'

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  algorithmMode: 'ML_BLEND',
  floorMultiplier: 0.75,
  ceilingMultiplier: 2.0,
  elasticity: 1.4,
  weights: {
    occupancy: 0.4,
    urgency: 0.3,
    dayType: 0.12,
    competitor: 0.1,
    seasonality: 0.08
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function norm(value: number, max: number): number {
  return clamp(value / max, -1, 1)
}

// Each raw*() function models one signal a real yield-management system would
// feed a demand model. Ranges are hand-tuned so no single factor can dominate
// once normalized, matching the ceiling on how much weight the UI sliders allow.

function rawOccupancy(occupancyPct: number): number {
  if (occupancyPct <= 50) return (occupancyPct - 50) * 0.6 // -30 .. 0
  if (occupancyPct <= 80) return (occupancyPct - 50) * 0.8 // 0 .. 24
  return 24 + (occupancyPct - 80) * 1.8 // 24 .. 60
}

function rawUrgency(daysToDeparture: number, occupancyPct: number): number {
  const closeness = clamp(1 - daysToDeparture / 21, 0, 1) // 0 far out -> 1 at departure
  if (occupancyPct >= 55) return closeness * 45 // scarcity premium as seats run out
  if (occupancyPct <= 25) return -closeness * 35 // clearance pressure on empty buses
  return closeness * 8
}

function rawDayType(dayOfWeek: number, isHoliday: boolean): number {
  let f = 0
  if (dayOfWeek === 5 || dayOfWeek === 6) f += 12 // Fri/Sat departure rush
  if (dayOfWeek === 0) f += 6 // Sunday return traffic
  if (isHoliday) f += 22
  return f // 0 .. 34
}

function rawCompetitor(basePrice: number, competitorAvg: number): number {
  if (!competitorAvg) return 0
  const gap = (competitorAvg - basePrice) / basePrice
  return clamp(gap * 100 * 0.5, -20, 20)
}

function rawSeasonality(dateISO: string, popularity: number): number {
  const month = new Date(dateISO).getMonth()
  let seasonal = 0
  if (month === 9 || month === 10) seasonal += 10 // festive season
  if (month === 4 || month === 5) seasonal += 6 // summer holidays
  return seasonal * (popularity / 100) // 0 .. 16
}

export interface DemandInputs {
  occupancyPct: number
  daysToDeparture: number
  dateISO: string
  isHoliday: boolean
  basePrice: number
  competitorAvg: number
  popularity: number
}

export function computeRecommendation(inputs: DemandInputs, config: PricingConfig): PriceRecommendation {
  const dayOfWeek = new Date(inputs.dateISO).getDay()

  const occ = rawOccupancy(inputs.occupancyPct)
  const urg = rawUrgency(inputs.daysToDeparture, inputs.occupancyPct)
  const day = rawDayType(dayOfWeek, inputs.isHoliday)
  const comp = rawCompetitor(inputs.basePrice, inputs.competitorAvg)
  const season = rawSeasonality(inputs.dateISO, inputs.popularity)

  const w = config.weights
  const weightSum = w.occupancy + w.urgency + w.dayType + w.competitor + w.seasonality || 1

  const normOcc = norm(occ, 60)
  const normUrg = norm(urg, 45)
  const normDay = norm(day, 34)
  const normComp = norm(comp, 20)
  const normSeason = norm(season, 16)

  const contribution = {
    occupancy: (w.occupancy / weightSum) * normOcc * 50,
    urgency: (w.urgency / weightSum) * normUrg * 50,
    dayType: (w.dayType / weightSum) * normDay * 50,
    competitor: (w.competitor / weightSum) * normComp * 50,
    seasonality: (w.seasonality / weightSum) * normSeason * 50
  }

  const factors: PriceFactors = contribution
  const swing = contribution.occupancy + contribution.urgency + contribution.dayType + contribution.competitor + contribution.seasonality
  const demandScore = clamp(50 + swing, 0, 100)

  const centered = (demandScore - 50) / 50 // -1 .. 1
  const rawMultiplier = 1 + centered * config.elasticity * 0.5
  const multiplier = clamp(rawMultiplier, config.floorMultiplier, config.ceilingMultiplier)
  const recommendedPrice = Math.round((inputs.basePrice * multiplier) / 10) * 10

  const reasoning = buildReasoning(factors, inputs, multiplier)

  return { demandScore: Math.round(demandScore), recommendedPrice, multiplier, factors, reasoning }
}

function buildReasoning(factors: PriceFactors, inputs: DemandInputs, multiplier: number): string[] {
  const entries = Object.entries(factors) as [keyof PriceFactors, number][]
  const sorted = entries.filter(([, v]) => Math.abs(v) > 1.5).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
  const labels: Record<keyof PriceFactors, string> = {
    occupancy: `Occupancy at ${Math.round(inputs.occupancyPct)}%`,
    urgency: inputs.daysToDeparture <= 3 ? 'Departure is imminent' : 'Time-to-departure',
    dayType: inputs.isHoliday ? 'Holiday departure' : 'Weekend/peak-day travel',
    competitor: inputs.competitorAvg > inputs.basePrice ? 'Competitors priced higher' : 'Competitors priced lower',
    seasonality: 'Seasonal demand window'
  }
  const out = sorted.slice(0, 3).map(([k, v]) => `${labels[k]} ${v >= 0 ? 'pushes price up' : 'pulls price down'}`)
  if (out.length === 0) out.push('Demand is balanced — price holds near base fare')
  out.push(`Net effect: ${multiplier >= 1 ? '+' : ''}${Math.round((multiplier - 1) * 100)}% vs base fare`)
  return out
}

export interface CurvePoint {
  daysToDeparture: number
  price: number
  demandScore: number
}

// Projects how the recommended price would move as departure approaches, holding
// occupancy fixed — this is what the Simulator and Trip Detail charts plot.
export function simulateCurve(
  base: Omit<DemandInputs, 'daysToDeparture'>,
  config: PricingConfig,
  maxDays = 21
): CurvePoint[] {
  const points: CurvePoint[] = []
  for (let d = maxDays; d >= 0; d--) {
    const rec = computeRecommendation({ ...base, daysToDeparture: d }, config)
    points.push({ daysToDeparture: d, price: rec.recommendedPrice, demandScore: rec.demandScore })
  }
  return points
}
