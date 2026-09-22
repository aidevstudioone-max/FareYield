import React from 'react'
import { Link } from 'react-router-dom'
import { Card, currency, currencyK, DemandBadge, EmptyState, MultiLineChart, PageHeader, pct, ProgressBar, StatCard } from '../components/ui'
import { dashboardKpis, enrichedTrips, getConfig, priceAlerts, recommendationFor, revenueTrend, routePerformance } from '../lib/selectors'

export default function Dashboard() {
  const kpis = dashboardKpis()
  const config = getConfig()
  const trend = revenueTrend(14)
  const alerts = priceAlerts(config).slice(0, 5)
  const routes = routePerformance().slice(0, 5)

  const nearTerm = enrichedTrips().filter((e) => e.daysToDeparture <= 14)
  const bands = { low: 0, moderate: 0, high: 0, veryHigh: 0 }
  nearTerm.forEach((e) => {
    const score = recommendationFor(e, config).demandScore
    if (score >= 75) bands.veryHigh++
    else if (score >= 58) bands.high++
    else if (score >= 40) bands.moderate++
    else bands.low++
  })

  return (
    <div>
      <PageHeader
        title="Dynamic pricing, live"
        subtitle="How the pricing engine is valuing every upcoming departure right now, and what it's changed versus flat fares."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard label="Revenue (30d, dynamic)" value={currencyK(kpis.revenue30d)} tone="good" />
        <StatCard
          label="Uplift vs static pricing"
          value={`${kpis.upliftPct >= 0 ? '+' : ''}${kpis.upliftPct.toFixed(1)}%`}
          tone={kpis.upliftPct >= 0 ? 'good' : 'danger'}
          hint="trailing 30 days"
        />
        <StatCard label="Departing today" value={String(kpis.departingToday)} hint="trips across the fleet" />
        <StatCard label="Avg. seat occupancy" value={pct(kpis.avgOccupancy)} hint={`avg demand score ${Math.round(kpis.avgDemand)}/100`} />
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        <Link to="/analytics" className="lg:col-span-2 group block">
          <Card className="p-4 h-full transition-all group-hover:shadow-md group-hover:ring-1 group-hover:ring-brand-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800">Revenue — dynamic vs. static, last 14 days</h3>
              <span className="text-xs text-brand-600 group-hover:underline inline-flex items-center gap-0.5">
                Open analytics <span className="transition-transform group-hover:translate-x-0.5">→</span>
              </span>
            </div>
            <MultiLineChart
              labels={trend.map((d) => d.date.slice(5))}
              series={[
                { name: 'Dynamic pricing', values: trend.map((d) => d.dynamicRevenue), color: '#4f46e5' },
                { name: 'Static baseline', values: trend.map((d) => d.staticRevenue), color: '#cbd5e1' }
              ]}
              format={(n) => currencyK(n)}
            />
          </Card>
        </Link>

        <Card className="p-4">
          <h3 className="font-semibold text-slate-800 mb-1">Demand mix — next 14 days</h3>
          <p className="text-xs text-slate-400 mb-3">{nearTerm.length} upcoming departures scored by the engine</p>
          <div className="space-y-2">
            {[
              { label: 'Very high demand', value: bands.veryHigh, tone: 'red' as const },
              { label: 'High demand', value: bands.high, tone: 'amber' as const },
              { label: 'Moderate demand', value: bands.moderate, tone: 'brand' as const },
              { label: 'Low demand', value: bands.low, tone: 'green' as const }
            ].map((b) => (
              <div key={b.label}>
                <div className="flex justify-between text-xs text-slate-500 mb-0.5">
                  <span>{b.label}</span>
                  <span>{b.value}</span>
                </div>
                <ProgressBar value={nearTerm.length ? (b.value / nearTerm.length) * 100 : 0} tone={b.tone === 'red' ? 'red' : b.tone === 'amber' ? 'amber' : b.tone === 'green' ? 'green' : 'brand'} />
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800">Price alerts — recommendation vs. applied fare</h3>
            <Link to="/trips" className="text-xs text-brand-600 hover:underline">
              View all trips →
            </Link>
          </div>
          {alerts.length === 0 ? (
            <EmptyState title="No trips need a price review" subtitle="Every departure in the next 10 days is within the alert threshold." />
          ) : (
            <div className="space-y-2">
              {alerts.map((a) => (
                <Link
                  key={a.trip.id}
                  to={`/trips/${a.trip.id}`}
                  className="flex items-center justify-between text-sm px-3 py-2 rounded-lg hover:bg-slate-50 border border-slate-100"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 truncate">
                      {a.route.origin} → {a.route.destination}
                    </p>
                    <p className="text-xs text-slate-400">
                      {a.trip.date} · {a.bus.departureTime} · {a.daysToDeparture === 0 ? 'departs today' : `${a.daysToDeparture}d out`}
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="font-semibold text-slate-800">{currency(a.recommendedPrice)}</p>
                    <p className={`text-xs ${a.deltaPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {a.deltaPct >= 0 ? '+' : ''}
                      {a.deltaPct.toFixed(0)}% vs applied
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="font-semibold text-slate-800 mb-3">Top routes by occupancy</h3>
          <div className="space-y-3">
            {routes.map((r) => (
              <div key={r.route.id} className="text-sm">
                <div className="flex justify-between mb-1">
                  <span className="text-slate-700 truncate">
                    {r.route.origin} → {r.route.destination}
                  </span>
                  <DemandBadge score={r.avgOccupancy} />
                </div>
                <ProgressBar value={r.avgOccupancy} tone={r.avgOccupancy > 70 ? 'green' : r.avgOccupancy > 45 ? 'amber' : 'red'} />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
