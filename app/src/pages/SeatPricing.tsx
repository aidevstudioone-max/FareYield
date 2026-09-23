import React, { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge, Button, Card, currency, Field, inputCls, PageHeader, Select, Tabs } from '../components/ui'
import { COLLECTIONS, getAll } from '../lib/db'
import { fmtWeekday } from '../lib/format'
import {
  busMap,
  clearSeatOverride,
  currentTripPerformance,
  getSeatLimits,
  lastDowPerformance,
  routeMap,
  saveSeatLimits,
  seatMapForTrip,
  seatOverridesForTrip,
  setSeatOverride,
  tripDaysToDeparture
} from '../lib/selectors'
import type { SeatLimits, Trip } from '../lib/types'
import type { SeatInfo } from '../lib/seatMap'

const TABS = ['Bus Pricing', 'Seat Pricing', 'Via Pricing']

export default function SeatPricing() {
  const { id } = useParams()
  const trip = getAll<Trip>(COLLECTIONS.trips).find((t) => t.id === id)
  const route = trip ? routeMap()[trip.routeId] : undefined
  const bus = trip ? busMap()[trip.busId] : undefined

  const [tab, setTab] = useState(TABS[0])
  const [selectedSeatId, setSelectedSeatId] = useState<string | null>(null)
  const [highlightPrice, setHighlightPrice] = useState<number | null>(null)
  const [overrideInput, setOverrideInput] = useState('')
  const [overridesVersion, setOverridesVersion] = useState(0)
  const [limits, setLimits] = useState<SeatLimits | null>(trip ? getSeatLimits(trip.id) : null)
  const [lowerInput, setLowerInput] = useState(limits?.lower != null ? String(limits.lower) : '')
  const [upperInput, setUpperInput] = useState(limits?.upper != null ? String(limits.upper) : '')
  const [viaInput, setViaInput] = useState(limits ? String(limits.viaDiscountPct) : '0')

  const overrides = useMemo(() => (trip ? seatOverridesForTrip(trip.id) : {}), [trip, overridesVersion])
  const seats: SeatInfo[] = useMemo(() => (trip && bus ? seatMapForTrip(trip, bus) : []), [trip, bus])

  if (!trip || !route || !bus || !limits) {
    return (
      <div>
        <PageHeader title="Trip not found" />
        <Link to="/trips" className="text-brand-600 text-sm hover:underline">
          ← Back to Live Pricing
        </Link>
      </div>
    )
  }

  const daysToDeparture = tripDaysToDeparture(trip)
  const current = currentTripPerformance(seats, overrides, limits)
  const lastDow = lastDowPerformance(trip)
  const isSleeper = bus.type === 'AC_SLEEPER'
  const lowerDeck = seats.filter((s) => s.deck === 'LOWER' || s.deck === 'SEATER')
  const upperDeck = seats.filter((s) => s.deck === 'UPPER')

  const priceOf = (seat: SeatInfo) => {
    let p = overrides[seat.id] ?? seat.basePrice
    if (!seat.isBooked) {
      if (limits.cutSeatDiscount) p *= 0.92
      if (limits.postDepartureDiscount) p *= 0.95
    }
    if (limits.lower != null) p = Math.max(limits.lower, p)
    if (limits.upper != null) p = Math.min(limits.upper, p)
    return Math.round(p / 5) * 5
  }

  const quickPrices = Array.from(new Set(seats.filter((s) => !s.isBooked).map((s) => priceOf(s)))).sort((a, b) => a - b).slice(0, 6)
  const selectedSeat = seats.find((s) => s.id === selectedSeatId) ?? null

  function seatBtnClass(seat: SeatInfo) {
    if (seat.isBooked) return 'bg-rose-100 border-rose-300 text-rose-700 cursor-not-allowed'
    if (seat.id === selectedSeatId) return 'bg-brand-600 border-brand-600 text-white shadow-md'
    if (highlightPrice != null && priceOf(seat) === highlightPrice) return 'bg-amber-100 border-amber-400 text-amber-800'
    return 'bg-white border-slate-200 text-slate-700 hover:border-brand-300 hover:bg-brand-50'
  }

  function renderDeck(deckSeats: SeatInfo[], label: string) {
    if (!deckSeats.length) return null
    const rows = Array.from(new Set(deckSeats.map((s) => s.row))).sort((a, b) => a - b)
    return (
      <div className="mb-5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{label}</p>
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div key={r} className="flex gap-1.5">
              {deckSeats
                .filter((s) => s.row === r)
                .map((seat) => (
                  <button
                    key={seat.id}
                    disabled={seat.isBooked}
                    onClick={() => {
                      setSelectedSeatId(seat.id)
                      setOverrideInput('')
                      setTab('Seat Pricing')
                    }}
                    className={`w-16 shrink-0 rounded-lg border px-1 py-1.5 text-center transition-colors ${seatBtnClass(seat)}`}
                  >
                    <div className="text-[10px] font-semibold leading-tight">{seat.id}</div>
                    <div className="text-[11px] font-bold leading-tight">{priceOf(seat)}</div>
                  </button>
                ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <Link to={`/trips/${trip.id}`} className="text-brand-600 text-sm hover:underline mb-3 inline-block">
        ← Back to Trip Detail
      </Link>

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900 font-display">
              {route.origin} → {route.destination} @ {bus.departureTime}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {trip.date} ({fmtWeekday(trip.date)}) · {bus.type.replace(/_/g, ' ')} ·{' '}
              {daysToDeparture === 0 ? 'departs today' : `${daysToDeparture}d out`}
            </p>
            {route.popularity >= 85 && <Badge tone="red">Critical route</Badge>}
          </div>
          <div className="text-xs text-slate-600 grid grid-cols-2 gap-x-6 gap-y-1">
            <span className="text-slate-400">Avg sold price</span>
            <span className="font-semibold text-slate-800">{currency(current.asp)}</span>
            <span className="text-slate-400">Last DOW performance</span>
            <span className="font-semibold text-brand-700">
              {Math.round(lastDow.occupancyPct)}% · {currency(lastDow.revenue)}
            </span>
            <span className="text-slate-400">Current performance</span>
            <span className="font-semibold text-emerald-600">
              {Math.round(current.occupancyPct)}% · {currency(current.revenue)}
            </span>
            <span className="text-slate-400">Price rounding</span>
            <span className="font-semibold text-slate-800">Nearest ₹5, post-GST</span>
          </div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-4 lg:col-span-2">
          {quickPrices.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-xs text-slate-500 self-center mr-1">Quick filter:</span>
              {quickPrices.map((p) => (
                <button
                  key={p}
                  onClick={() => setHighlightPrice(highlightPrice === p ? null : p)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                    highlightPrice === p ? 'bg-amber-400 border-amber-500 text-amber-950' : 'bg-brand-50 border-brand-100 text-brand-700'
                  }`}
                >
                  {currency(p)}
                </button>
              ))}
            </div>
          )}
          <div className="overflow-x-auto">
            <div className="min-w-max">
              {renderDeck(lowerDeck, isSleeper ? 'Lower deck' : 'Seating')}
              {renderDeck(upperDeck, 'Upper deck')}
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500 border-t border-slate-100 pt-3 mt-2">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-rose-100 border border-rose-300 inline-block" /> Sold
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-white border border-slate-200 inline-block" /> Available
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-brand-600 inline-block" /> Selected
            </span>
          </div>
        </Card>

        <Card className="p-4">
          <Tabs tabs={TABS} active={tab} onChange={setTab} />

          {tab === 'Bus Pricing' && (
            <div>
              <Field label="Lower limit" hint="Never price a seat below this.">
                <input className={inputCls} type="number" value={lowerInput} onChange={(e) => setLowerInput(e.target.value)} placeholder="No floor" />
              </Field>
              <Field label="Upper limit" hint="Never price a seat above this.">
                <input className={inputCls} type="number" value={upperInput} onChange={(e) => setUpperInput(e.target.value)} placeholder="No ceiling" />
              </Field>
              <Field label="Apply cut-seat discount" hint="8% off unsold seats to clear inventory.">
                <Select value={limits.cutSeatDiscount ? 'Yes' : 'No'} onChange={(v) => setLimits({ ...limits, cutSeatDiscount: v === 'Yes' })}>
                  <option>Yes</option>
                  <option>No</option>
                </Select>
              </Field>
              <Field label="Apply post-departure discount" hint="Extra 5% off for boarding after departure.">
                <Select value={limits.postDepartureDiscount ? 'Yes' : 'No'} onChange={(v) => setLimits({ ...limits, postDepartureDiscount: v === 'Yes' })}>
                  <option>Yes</option>
                  <option>No</option>
                </Select>
              </Field>
              <Button
                className="w-full mt-1"
                variant="primary"
                onClick={() => {
                  const updated: SeatLimits = {
                    ...limits,
                    lower: lowerInput ? Number(lowerInput) : null,
                    upper: upperInput ? Number(upperInput) : null
                  }
                  saveSeatLimits(updated)
                  setLimits(updated)
                }}
              >
                Apply to bus
              </Button>
            </div>
          )}

          {tab === 'Seat Pricing' &&
            (selectedSeat ? (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-lg font-bold text-slate-900 font-display">{selectedSeat.id}</p>
                    <p className="text-xs text-slate-400">
                      {selectedSeat.deck} deck · {selectedSeat.isBooked ? 'Sold' : 'Available'}
                    </p>
                  </div>
                  <p className="text-xl font-bold text-brand-700 font-display">{currency(priceOf(selectedSeat))}</p>
                </div>
                <Field label="Override price">
                  <input
                    className={inputCls}
                    type="number"
                    placeholder={String(priceOf(selectedSeat))}
                    value={overrideInput}
                    onChange={(e) => setOverrideInput(e.target.value)}
                  />
                </Field>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => {
                      const v = Number(overrideInput)
                      if (v > 0) {
                        setSeatOverride(trip.id, selectedSeat.id, v)
                        setOverridesVersion((n) => n + 1)
                        setOverrideInput('')
                      }
                    }}
                  >
                    Save
                  </Button>
                  {overrides[selectedSeat.id] != null && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        clearSeatOverride(trip.id, selectedSeat.id)
                        setOverridesVersion((n) => n + 1)
                      }}
                    >
                      Clear override
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-8">Select a seat on the map to price it individually.</p>
            ))}

          {tab === 'Via Pricing' && (
            <div>
              <p className="text-xs text-slate-500 mb-3">
                Adjusts fares for passengers boarding or alighting at an intermediate stop along this route, rather than the full origin-to-destination
                journey.
              </p>
              <Field label="Via discount %" hint="Applied on top of the seat fare for via bookings.">
                <input className={inputCls} type="number" value={viaInput} onChange={(e) => setViaInput(e.target.value)} />
              </Field>
              <Button
                className="w-full"
                onClick={() => {
                  const updated: SeatLimits = { ...limits, viaDiscountPct: Number(viaInput) || 0 }
                  saveSeatLimits(updated)
                  setLimits(updated)
                }}
              >
                Save via pricing
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
