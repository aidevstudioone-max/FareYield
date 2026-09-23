import React from 'react'
import { Link } from 'react-router-dom'
import {
  Card,
  currency,
  currencyK,
  DemandBadge,
  DualAxisChart,
  EmptyState,
  fmtDateShort,
  fmtWeekday,
  Gauge,
  MultiLineChart,
  num,
  PageHeader,
  pct,
  ProgressBar,
  Table
} from '../components/ui'
import LiveTicker from '../components/LiveTicker'
import {
  competitorAvgForRoute,
  earningsTrend,
  enrichedTrips,
  getConfig,
  past30DaysReport,
  pastDayReport,
  priceAlerts,
  recommendationFor,
  revenueTrend,
  routePerformance,
  weekOnWeekRows,
  type EnrichedTrip
} from '../lib/selectors'

export default function Dashboard() {
  const config = getConfig()
  const trend = revenueTrend(14)
  const alerts = priceAlerts(config).slice(0, 5)
  const routes = routePerformance().slice(0, 5)
  const pastDay = pastDayReport()
  const past30 = past30DaysReport()
  const earnings = earningsTrend(30)
  const wow = weekOnWeekRows(6)

  const nearTerm = enrichedTrips().filter((e) => e.daysToDeparture <= 14)
  const bands = { low: 0, moderate: 0, high: 0, veryHigh: 0 }
  nearTerm.forEach((e) => {
    const score = recommendationFor(e, config).demandScore
    if (score >= 75) bands.veryHigh++
    else if (score >= 58) bands.high++
    else if (score >= 40) bands.moderate++
    else bands.low++
  })

  // One live ticker per route — its next upcoming departure, since
  // enrichedTrips() is already sorted by days-to-departure ascending.
  const byRoute = new Map<string, EnrichedTrip>()
  enrichedTrips().forEach((e) => {
    if (!byRoute.has(e.route.id)) byRoute.set(e.route.id, e)
  })
  const liveRoutes = Array.from(byRoute.values()).sort((a, b) => a.route.origin.localeCompare(b.route.origin))

  return (
    <div>
      <PageHeader
        title="Dynamic pricing, live"
        subtitle="How the pricing engine is valuing every upcoming departure right now, and what it's changed versus flat fares."
      />

      <h3 className="font-semibold text-slate-800 mb-2">Live fare board — every route, right now</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        {liveRoutes.map((e, i) => (
          <LiveTicker
            key={e.route.id}
            compact
            phaseSeed={i * 1.37}
            label={`${e.route.origin} → ${e.route.destination}`}
            sublabel={`${e.bus.type.replace(/_/g, ' ')} · ${e.trip.date} · ${e.bus.departureTime}`}
            basePrice={e.trip.basePrice}
            baseOccupancy={e.occupancyPct}
            baseCompetitor={competitorAvgForRoute(e.route.id) || e.trip.basePrice}
            daysToDeparture={e.daysToDeparture}
            dateISO={e.trip.date}
            isHoliday={e.trip.isHoliday}
            popularity={e.route.popularity}
            config={config}
          />
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        {pastDay && (
          <Card className="p-4">
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="font-semibold text-slate-800">Past day report</h3>
              <span className="text-xs text-slate-400">{fmtDateShort(pastDay.date)}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="border-l-4 border-brand-500 bg-slate-50 rounded-r-lg px-3 py-2.5">
                <p className="text-[11px] text-slate-500 uppercase tracking-wide">Total routes</p>
                <p className="text-xl font-bold text-slate-900 font-display">{pastDay.routesOperated}</p>
              </div>
              <div className="border-l-4 border-brand-500 bg-slate-50 rounded-r-lg px-3 py-2.5">
                <p className="text-[11px] text-slate-500 uppercase tracking-wide">No. of trips</p>
                <p className="text-xl font-bold text-slate-900 font-display">{pastDay.tripsCount}</p>
              </div>
            </div>
          </Card>
        )}

        {past30 && (
          <Card className="p-4">
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="font-semibold text-slate-800">Past 30 days report</h3>
              <span className="text-xs text-slate-400">
                {fmtDateShort(past30.from)} to {fmtDateShort(past30.to)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="border-l-4 border-brand-500 bg-slate-50 rounded-r-lg px-2.5 py-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Revenue</p>
                <p className="text-base font-bold text-slate-900 font-display">{currencyK(past30.revenue)}</p>
              </div>
              <div className="border-l-4 border-brand-500 bg-slate-50 rounded-r-lg px-2.5 py-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Seats sold</p>
                <p className="text-base font-bold text-slate-900 font-display">{num(past30.seatsSold)}</p>
              </div>
              <div className="border-l-4 border-brand-500 bg-slate-50 rounded-r-lg px-2.5 py-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">ASP</p>
                <p className="text-base font-bold text-slate-900 font-display">{currency(past30.asp)}</p>
              </div>
              <div className="border-l-4 border-brand-500 bg-slate-50 rounded-r-lg px-2.5 py-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Occupancy</p>
                <p className="text-base font-bold text-slate-900 font-display">{pct(past30.occupancyPct)}</p>
              </div>
              <div className="border-l-4 border-brand-500 bg-slate-50 rounded-r-lg px-2.5 py-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Main | Via</p>
                <p className="text-base font-bold text-slate-900 font-display">
                  {Math.round(past30.mainPct)}% <span className="text-slate-400 text-sm">/ {Math.round(past30.viaPct)}%</span>
                </p>
              </div>
              <div className="border-l-4 border-brand-500 bg-slate-50 rounded-r-lg px-2.5 py-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-wide">Online | Offline</p>
                <p className="text-sm font-bold text-slate-900 font-display">
                  {num(past30.onlineBookings)} <span className="text-slate-400">/ {num(past30.offlineBookings)}</span>
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
        {pastDay && (
          <Card className="p-4">
            <h3 className="font-semibold text-slate-800 mb-1">Past day occupancy</h3>
            <p className="text-xs text-slate-400 mb-2">Self vs. estimated market average</p>
            <div className="flex items-center justify-around">
              <Gauge value={pastDay.selfOccupancyPct} label="Self occupancy" size={140} />
              <Gauge value={pastDay.marketOccupancyPct} label="Market occupancy" size={140} />
            </div>
          </Card>
        )}

        <Card className="p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-800">Past 30 days earning overview</h3>
          </div>
          <DualAxisChart
            labels={earnings.map((d) => d.date.slice(5))}
            seriesA={{ name: 'Revenue', values: earnings.map((d) => d.dynamicRevenue), color: '#f59e0b', format: (n) => currencyK(n) }}
            seriesB={{ name: 'Seats sold', values: earnings.map((d) => d.seatsSold), color: '#4f46e5', format: (n) => num(n) }}
          />
        </Card>
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

      <div className="grid lg:grid-cols-3 gap-4 mb-4">
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

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="font-semibold text-slate-800">Week-on-week report</h3>
          <span className="text-xs text-slate-400">— same weekday, last {wow.length} weeks</span>
        </div>
        <Table
          columns={[
            'Date',
            'No. of trips',
            'Revenue',
            'Revenue/trip',
            'ASP',
            'Occupancy',
            'Adv. bkg',
            'Seats sold',
            'Multi bookings',
            'Post-dept. bkg',
            'Main | Via',
            'Online | Offline'
          ]}
        >
          {wow.map((d) => (
            <tr key={d.date} className="hover:bg-slate-50">
              <td className="py-2.5 px-3 font-medium text-slate-800 whitespace-nowrap">
                {d.date}
                <span className="block text-[11px] text-slate-400 font-normal">{fmtWeekday(d.date)}</span>
              </td>
              <td className="py-2.5 px-3 text-slate-600">{d.tripsCount}</td>
              <td className="py-2.5 px-3 text-slate-600">{currency(d.dynamicRevenue)}</td>
              <td className="py-2.5 px-3 text-slate-600">{currency(d.dynamicRevenue / d.tripsCount)}</td>
              <td className="py-2.5 px-3 text-slate-600">{currency(d.dynamicRevenue / d.seatsSold)}</td>
              <td className="py-2.5 px-3 text-slate-600">{pct(d.selfOccupancyPct)}</td>
              <td className="py-2.5 px-3 text-slate-600">{num(d.advanceBookings)}</td>
              <td className="py-2.5 px-3 text-slate-600">{num(d.seatsSold)}</td>
              <td className="py-2.5 px-3 text-slate-600">{num(d.multiBookings)}</td>
              <td className="py-2.5 px-3 text-slate-600">{num(d.postDepartureBookings)}</td>
              <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                {num(d.mainSeats)} | {num(d.viaSeats)}
              </td>
              <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                {num(d.onlineBookings)} | {num(d.offlineBookings)}
              </td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  )
}
