import React from 'react'
import { Card, currencyK, DonutChart, MultiLineChart, PageHeader, pct, StatCard, Table } from '../components/ui'
import { COLLECTIONS, getAll } from '../lib/db'
import { enrichedTrips, getConfig, recommendationFor, routePerformance } from '../lib/selectors'
import type { DailyRevenueRecord } from '../lib/types'

export default function Analytics() {
  const daily = getAll<DailyRevenueRecord>(COLLECTIONS.dailyRevenue)
  const dynamicSum = daily.reduce((s, d) => s + d.dynamicRevenue, 0)
  const staticSum = daily.reduce((s, d) => s + d.staticRevenue, 0)
  const upliftPct = staticSum ? ((dynamicSum - staticSum) / staticSum) * 100 : 0
  const avgDemand = daily.length ? daily.reduce((s, d) => s + d.avgDemandScore, 0) / daily.length : 0

  const config = getConfig()
  const trips = enrichedTrips()
  const bands = { low: 0, moderate: 0, high: 0, veryHigh: 0 }
  trips.forEach((e) => {
    const score = recommendationFor(e, config).demandScore
    if (score >= 75) bands.veryHigh++
    else if (score >= 58) bands.high++
    else if (score >= 40) bands.moderate++
    else bands.low++
  })

  const perf = routePerformance()

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Revenue impact of dynamic pricing over the last 60 days, and how demand is distributed across the fleet today." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Dynamic revenue (60d)" value={currencyK(dynamicSum)} tone="good" />
        <StatCard label="Static baseline (60d)" value={currencyK(staticSum)} />
        <StatCard label="Uplift" value={`${upliftPct >= 0 ? '+' : ''}${upliftPct.toFixed(1)}%`} tone={upliftPct >= 0 ? 'good' : 'danger'} />
        <StatCard label="Avg demand score" value={`${Math.round(avgDemand)}/100`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Card className="p-4 lg:col-span-2">
          <h3 className="font-semibold text-slate-800 mb-3">Revenue — dynamic vs. static, 60 days</h3>
          <MultiLineChart
            labels={daily.map((d) => d.date.slice(5))}
            series={[
              { name: 'Dynamic pricing', values: daily.map((d) => d.dynamicRevenue), color: '#4f46e5' },
              { name: 'Static baseline', values: daily.map((d) => d.staticRevenue), color: '#cbd5e1' }
            ]}
            format={(n) => currencyK(n)}
            height={240}
          />
        </Card>

        <Card className="p-4 flex flex-col items-center">
          <h3 className="font-semibold text-slate-800 mb-3 self-start">Demand mix — all upcoming trips</h3>
          <DonutChart
            segments={[
              { label: 'Very high', value: bands.veryHigh, color: '#ef4444' },
              { label: 'High', value: bands.high, color: '#f59e0b' },
              { label: 'Moderate', value: bands.moderate, color: '#6366f1' },
              { label: 'Low', value: bands.low, color: '#94a3b8' }
            ]}
          />
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-4 text-xs w-full">
            {[
              { label: 'Very high', value: bands.veryHigh, color: '#ef4444' },
              { label: 'High', value: bands.high, color: '#f59e0b' },
              { label: 'Moderate', value: bands.moderate, color: '#6366f1' },
              { label: 'Low', value: bands.low, color: '#94a3b8' }
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-1.5 text-slate-600">
                <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                {s.label} ({s.value})
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="font-semibold text-slate-800 mb-3">Route performance</h3>
        <Table columns={['Route', 'Upcoming trips', 'Avg occupancy', 'Avg fare vs base']}>
          {perf.map((r) => (
            <tr key={r.route.id} className="hover:bg-slate-50">
              <td className="py-2.5 px-3 font-medium text-slate-800">
                {r.route.origin} → {r.route.destination}
              </td>
              <td className="py-2.5 px-3 text-slate-600">{r.trips}</td>
              <td className="py-2.5 px-3 text-slate-600">{pct(r.avgOccupancy)}</td>
              <td className={`py-2.5 px-3 font-medium ${r.avgUpliftPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {r.avgUpliftPct >= 0 ? '+' : ''}
                {r.avgUpliftPct.toFixed(1)}%
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  )
}
