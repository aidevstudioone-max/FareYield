import React, { useMemo, useState } from 'react'
import { Card, currency, DemandBadge, Field, MultiLineChart, PageHeader, Select, Slider } from '../components/ui'
import { computeRecommendation, simulateCurve } from '../lib/pricingEngine'
import { getConfig } from '../lib/selectors'
import { addDaysISO } from '../lib/format'

const FACTOR_LABEL: Record<string, string> = {
  occupancy: 'Seat occupancy',
  urgency: 'Time to departure',
  dayType: 'Day type / holiday',
  competitor: 'Competitor pricing',
  seasonality: 'Seasonality'
}

const DAY_OFFSETS = [
  { label: 'Monday departure', offset: (1 - new Date().getDay() + 7) % 7 },
  { label: 'Friday departure', offset: (5 - new Date().getDay() + 7) % 7 },
  { label: 'Saturday departure', offset: (6 - new Date().getDay() + 7) % 7 },
  { label: 'Sunday departure', offset: (0 - new Date().getDay() + 7) % 7 }
]

export default function Simulator() {
  const config = getConfig()
  const [basePrice, setBasePrice] = useState(800)
  const [occupancyPct, setOccupancyPct] = useState(55)
  const [daysToDeparture, setDaysToDeparture] = useState(5)
  const [dayOffset, setDayOffset] = useState(DAY_OFFSETS[1].offset)
  const [isHoliday, setIsHoliday] = useState(false)
  const [competitorAvg, setCompetitorAvg] = useState(820)
  const [popularity, setPopularity] = useState(75)

  const dateISO = useMemo(() => addDaysISO(dayOffset), [dayOffset])

  const rec = useMemo(
    () => computeRecommendation({ basePrice, occupancyPct, daysToDeparture, dateISO, isHoliday, competitorAvg, popularity }, config),
    [basePrice, occupancyPct, daysToDeparture, dateISO, isHoliday, competitorAvg, popularity, config]
  )

  const curve = useMemo(
    () => simulateCurve({ basePrice, occupancyPct, dateISO, isHoliday, competitorAvg, popularity }, config, 21),
    [basePrice, occupancyPct, dateISO, isHoliday, competitorAvg, popularity, config]
  )

  return (
    <div>
      <PageHeader title="Pricing simulator" subtitle="Sandbox the engine — tune the inputs and see the recommended fare and demand score update instantly." />

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-4 lg:col-span-1 space-y-4">
          <Field label="Base fare">
            <Slider value={basePrice} min={300} max={2000} step={10} onChange={setBasePrice} format={(n) => currency(n)} />
          </Field>
          <Field label="Seat occupancy">
            <Slider value={occupancyPct} min={0} max={100} step={1} onChange={setOccupancyPct} format={(n) => `${n}%`} />
          </Field>
          <Field label="Days to departure">
            <Slider value={daysToDeparture} min={0} max={21} step={1} onChange={setDaysToDeparture} format={(n) => `${n}d`} />
          </Field>
          <Field label="Departure day">
            <Select value={String(dayOffset)} onChange={(v) => setDayOffset(Number(v))}>
              {DAY_OFFSETS.map((d) => (
                <option key={d.label} value={d.offset}>
                  {d.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Competitor average fare">
            <Slider value={competitorAvg} min={200} max={2200} step={10} onChange={setCompetitorAvg} format={(n) => currency(n)} />
          </Field>
          <Field label="Route popularity">
            <Slider value={popularity} min={0} max={100} step={1} onChange={setPopularity} format={(n) => `${n}/100`} />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={isHoliday} onChange={(e) => setIsHoliday(e.target.checked)} />
            Festival / holiday departure
          </label>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800">Recommendation</h3>
              <DemandBadge score={rec.demandScore} />
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Base fare</p>
                <p className="text-xl font-bold text-slate-800 font-display">{currency(basePrice)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Recommended fare</p>
                <p className="text-xl font-bold text-brand-700 font-display">{currency(rec.recommendedPrice)}</p>
              </div>
            </div>
            <div className="space-y-2 mb-3">
              {(Object.entries(rec.factors) as [keyof typeof rec.factors, number][]).map(([key, value]) => {
                const width = Math.min(100, Math.abs(value) * 2)
                return (
                  <div key={key} className="flex items-center gap-3 text-xs">
                    <span className="w-32 shrink-0 text-slate-600">{FACTOR_LABEL[key]}</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full relative overflow-hidden">
                      <div
                        className={`h-full rounded-full ${value >= 0 ? 'bg-emerald-500' : 'bg-red-400'}`}
                        style={{ width: `${width}%`, marginLeft: value >= 0 ? '50%' : `${50 - width}%` }}
                      />
                    </div>
                    <span className={`w-12 text-right font-medium ${value >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>{value.toFixed(1)}</span>
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
            <h3 className="font-semibold text-slate-800 mb-1">Price curve to departure</h3>
            <p className="text-xs text-slate-400 mb-3">Holding occupancy at {occupancyPct}% fixed while days-to-departure counts down.</p>
            <MultiLineChart
              labels={curve.map((c) => `${c.daysToDeparture}d`)}
              series={[{ name: 'Recommended fare', values: curve.map((c) => c.price), color: '#4f46e5' }]}
              format={(n) => currency(n)}
            />
          </Card>
        </div>
      </div>
    </div>
  )
}
