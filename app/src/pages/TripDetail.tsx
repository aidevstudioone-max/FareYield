import React, { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, Card, currency, DemandBadge, Field, inputCls, MultiLineChart, PageHeader, Sparkline } from '../components/ui'
import { COLLECTIONS, getAll, upsert } from '../lib/db'
import { simulateCurve } from '../lib/pricingEngine'
import { busMap, competitorAvgForRoute, getConfig, priceHistoryForTrip, recommendationFor, routeMap, tripDaysToDeparture } from '../lib/selectors'
import type { Trip } from '../lib/types'

const FACTOR_LABEL: Record<string, string> = {
  occupancy: 'Seat occupancy',
  urgency: 'Time to departure',
  dayType: 'Day type / holiday',
  competitor: 'Competitor pricing',
  seasonality: 'Seasonality'
}

export default function TripDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const allTrips = getAll<Trip>(COLLECTIONS.trips)
  const [trip, setTrip] = useState<Trip | undefined>(allTrips.find((t) => t.id === id))
  const [override, setOverride] = useState('')

  const route = trip ? routeMap()[trip.routeId] : undefined
  const bus = trip ? busMap()[trip.busId] : undefined

  if (!trip || !route || !bus) {
    return (
      <div>
        <PageHeader title="Trip not found" />
        <Link to="/trips" className="text-brand-600 text-sm hover:underline">
          ← Back to Live Pricing
        </Link>
      </div>
    )
  }

  const config = getConfig()
  const occupancyPct = (trip.bookedSeats / trip.totalSeats) * 100
  const daysToDeparture = tripDaysToDeparture(trip)
  const competitorAvg = competitorAvgForRoute(route.id)
  const rec = recommendationFor({ trip, route, bus, occupancyPct, daysToDeparture }, config)
  const curve = simulateCurve(
    { occupancyPct, dateISO: trip.date, isHoliday: trip.isHoliday, basePrice: trip.basePrice, competitorAvg, popularity: route.popularity },
    config,
    21
  )
  const history = priceHistoryForTrip(trip.id)
  const delta = ((rec.recommendedPrice - trip.appliedPrice) / trip.appliedPrice) * 100

  function persist(patch: Partial<Trip>) {
    const updated = { ...trip!, ...patch }
    upsert(COLLECTIONS.trips, updated)
    setTrip(updated)
  }

  return (
    <div>
      <Link to="/trips" className="text-brand-600 text-sm hover:underline mb-3 inline-block">
        ← Back to Live Pricing
      </Link>
      <PageHeader
        title={`${route.origin} → ${route.destination}`}
        subtitle={`${trip.date} · departs ${bus.departureTime} · ${bus.type.replace(/_/g, ' ')} · ${daysToDeparture === 0 ? 'departs today' : `${daysToDeparture} days out`}`}
        actions={<DemandBadge score={rec.demandScore} />}
      />

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Card className="p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Base fare</p>
          <p className="text-2xl font-bold text-slate-800 font-display">{currency(trip.basePrice)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Engine recommendation</p>
          <p className="text-2xl font-bold text-brand-700 font-display">{currency(rec.recommendedPrice)}</p>
          <p className="text-xs text-slate-400 mt-1">{Math.round((rec.multiplier - 1) * 100)}% vs base · {rec.demandScore}/100 demand</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Currently applied</p>
          <p className="text-2xl font-bold text-slate-800 font-display">{currency(trip.appliedPrice)}</p>
          <p className={`text-xs mt-1 ${Math.abs(delta) >= 8 ? (delta >= 0 ? 'text-emerald-600' : 'text-red-500') : 'text-slate-400'}`}>
            recommendation is {delta >= 0 ? '+' : ''}
            {delta.toFixed(0)}% away
          </p>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Card className="p-4 lg:col-span-2">
          <h3 className="font-semibold text-slate-800 mb-3">Why this price — factor breakdown</h3>
          <div className="space-y-2.5 mb-4">
            {(Object.entries(rec.factors) as [keyof typeof rec.factors, number][]).map(([key, value]) => {
              const pctWidth = Math.min(100, Math.abs(value) * 2)
              return (
                <div key={key} className="flex items-center gap-3 text-sm">
                  <span className="w-40 shrink-0 text-slate-600">{FACTOR_LABEL[key]}</span>
                  <div className="flex-1 h-2.5 bg-slate-100 rounded-full relative overflow-hidden">
                    <div
                      className={`h-full rounded-full ${value >= 0 ? 'bg-emerald-500' : 'bg-red-400'}`}
                      style={{ width: `${pctWidth}%`, marginLeft: value >= 0 ? '50%' : `${50 - pctWidth}%` }}
                    />
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-300" />
                  </div>
                  <span className={`w-14 text-right text-xs font-medium ${value >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {value >= 0 ? '+' : ''}
                    {value.toFixed(1)}
                  </span>
                </div>
              )
            })}
          </div>
          <ul className="text-sm text-slate-600 space-y-1 list-disc list-inside">
            {rec.reasoning.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold text-slate-800 mb-2">Take action</h3>
          <div className="space-y-2 mb-4">
            <Button className="w-full" onClick={() => persist({ appliedPrice: rec.recommendedPrice, autoApply: true })}>
              Apply recommendation ({currency(rec.recommendedPrice)})
            </Button>
            <Field label="Manual override">
              <div className="flex gap-2">
                <input className={inputCls} type="number" placeholder={String(trip.appliedPrice)} value={override} onChange={(e) => setOverride(e.target.value)} />
                <Button
                  variant="secondary"
                  onClick={() => {
                    const v = Number(override)
                    if (v > 0) {
                      persist({ appliedPrice: v, autoApply: false })
                      setOverride('')
                    }
                  }}
                >
                  Set
                </Button>
              </div>
            </Field>
          </div>
          <div className="flex items-center justify-between text-sm border-t border-slate-100 pt-3">
            <span className="text-slate-600">Auto-apply engine price</span>
            <Badge tone={trip.autoApply ? 'green' : 'slate'}>{trip.autoApply ? 'On' : 'Manual'}</Badge>
          </div>
          {history.length > 1 && (
            <div className="mt-4">
              <p className="text-xs text-slate-500 mb-1">Recommendation trail (last {history.length} checks)</p>
              <Sparkline values={history.map((h) => h.price)} width={220} height={44} />
            </div>
          )}
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="font-semibold text-slate-800 mb-3">Projected price as departure approaches</h3>
        <p className="text-xs text-slate-400 mb-3">Holds today's occupancy fixed and replays the engine across the pricing window.</p>
        <MultiLineChart
          labels={curve.map((c) => `${c.daysToDeparture}d`)}
          series={[{ name: 'Recommended price', values: curve.map((c) => c.price), color: '#4f46e5' }]}
          format={(n) => currency(n)}
        />
      </Card>

      <div className="mt-4 flex gap-2">
        <Button variant="secondary" onClick={() => navigate(`/trips/${trip.id}/seats`)}>
          Open seat-level pricing →
        </Button>
        <Button variant="ghost" onClick={() => navigate('/simulator')}>
          Open in Simulator →
        </Button>
      </div>
    </div>
  )
}
