import React, { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Card, currency, DemandBadge, EmptyState, PageHeader, Select, Table } from '../components/ui'
import { COLLECTIONS, getAll } from '../lib/db'
import { enrichedTrips, getConfig, recommendationFor } from '../lib/selectors'
import type { Route } from '../lib/types'

export default function Trips() {
  const [params, setParams] = useSearchParams()
  const routeFilter = params.get('route') ?? ''
  const [onlyAlerts, setOnlyAlerts] = useState(false)
  const routes = getAll<Route>(COLLECTIONS.routes)
  const config = getConfig()

  const rows = useMemo(() => {
    const config2 = config
    return enrichedTrips()
      .filter((e) => e.daysToDeparture <= 21)
      .filter((e) => !routeFilter || e.route.id === routeFilter)
      .map((e) => ({ ...e, rec: recommendationFor(e, config2) }))
      .filter((r) => !onlyAlerts || Math.abs(r.rec.recommendedPrice - r.trip.appliedPrice) / r.trip.appliedPrice >= 0.08)
      .slice(0, 120)
  }, [routeFilter, onlyAlerts, config])

  return (
    <div>
      <PageHeader
        title="Live pricing"
        subtitle="Every upcoming departure with the engine's current recommendation next to the fare shown to customers."
        actions={
          <label className="flex items-center gap-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2">
            <input type="checkbox" checked={onlyAlerts} onChange={(e) => setOnlyAlerts(e.target.checked)} />
            Needs review only
          </label>
        }
      />

      <div className="mb-3 max-w-xs">
        <Select value={routeFilter} onChange={(v) => setParams(v ? { route: v } : {})}>
          <option value="">All routes</option>
          {routes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.origin} → {r.destination}
            </option>
          ))}
        </Select>
      </div>

      <Card className="p-2">
        {rows.length === 0 ? (
          <EmptyState title="No trips match this filter" />
        ) : (
          <Table columns={['Route', 'Departure', 'Bus', 'Occupancy', 'Days out', 'Demand', 'Base', 'Recommended', 'Applied', '']}>
            {rows.map((r) => {
              const delta = ((r.rec.recommendedPrice - r.trip.appliedPrice) / r.trip.appliedPrice) * 100
              return (
                <tr key={r.trip.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-3 font-medium text-slate-800 whitespace-nowrap">
                    {r.route.origin} → {r.route.destination}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                    {r.trip.date} · {r.bus.departureTime}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">{r.bus.type.replace(/_/g, ' ')}</td>
                  <td className="py-2.5 px-3 text-slate-600">
                    {Math.round(r.occupancyPct)}% ({r.trip.bookedSeats}/{r.trip.totalSeats})
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">{r.daysToDeparture === 0 ? 'Today' : `${r.daysToDeparture}d`}</td>
                  <td className="py-2.5 px-3">
                    <DemandBadge score={r.rec.demandScore} />
                  </td>
                  <td className="py-2.5 px-3 text-slate-500">{currency(r.trip.basePrice)}</td>
                  <td className="py-2.5 px-3 font-medium text-slate-800">{currency(r.rec.recommendedPrice)}</td>
                  <td className="py-2.5 px-3">
                    <span className="font-medium text-slate-800">{currency(r.trip.appliedPrice)}</span>{' '}
                    <span className={`text-xs ${Math.abs(delta) >= 8 ? (delta >= 0 ? 'text-emerald-600' : 'text-red-500') : 'text-slate-400'}`}>
                      ({delta >= 0 ? '+' : ''}
                      {delta.toFixed(0)}%)
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <Link to={`/trips/${r.trip.id}`} className="text-xs text-brand-600 hover:underline whitespace-nowrap">
                      Details →
                    </Link>
                  </td>
                </tr>
              )
            })}
          </Table>
        )}
      </Card>
    </div>
  )
}
