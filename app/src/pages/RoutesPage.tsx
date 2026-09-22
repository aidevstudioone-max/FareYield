import React from 'react'
import { Link } from 'react-router-dom'
import { Badge, Card, currency, PageHeader, Table } from '../components/ui'
import { COLLECTIONS, getAll } from '../lib/db'
import { competitorAvgForRoute } from '../lib/selectors'
import type { Bus, Route, Trip } from '../lib/types'

const TYPE_LABEL: Record<string, string> = {
  AC_SLEEPER: 'AC Sleeper',
  NON_AC_SEATER: 'Non-AC Seater',
  VOLVO_MULTI_AXLE: 'Volvo Multi-Axle'
}

export default function RoutesPage() {
  const routes = getAll<Route>(COLLECTIONS.routes)
  const buses = getAll<Bus>(COLLECTIONS.buses)
  const trips = getAll<Trip>(COLLECTIONS.trips)

  return (
    <div>
      <PageHeader title="Routes & fleet" subtitle="Every route the engine prices, its bus mix, and how competitors are fared for comparison." />

      <Card className="p-2">
        <Table columns={['Route', 'Distance', 'Duration', 'Popularity', 'Bus types', 'Avg base fare', 'Competitor avg', '']}>
          {routes.map((route) => {
            const routeBuses = buses.filter((b) => b.routeId === route.id)
            const routeTrips = trips.filter((t) => t.routeId === route.id)
            const avgBase = routeTrips.length ? routeTrips.reduce((s, t) => s + t.basePrice, 0) / routeTrips.length : 0
            const compAvg = competitorAvgForRoute(route.id)
            return (
              <tr key={route.id} className="hover:bg-slate-50">
                <td className="py-2.5 px-3 font-medium text-slate-800 whitespace-nowrap">
                  {route.origin} → {route.destination}
                </td>
                <td className="py-2.5 px-3 text-slate-600">{route.distanceKm} km</td>
                <td className="py-2.5 px-3 text-slate-600">{route.durationHrs}h</td>
                <td className="py-2.5 px-3">
                  <Badge tone={route.popularity >= 80 ? 'red' : route.popularity >= 60 ? 'amber' : 'slate'}>{route.popularity}/100</Badge>
                </td>
                <td className="py-2.5 px-3 text-slate-600">
                  {[...new Set(routeBuses.map((b) => b.type))].map((t) => TYPE_LABEL[t]).join(', ')}
                </td>
                <td className="py-2.5 px-3 font-medium text-slate-800">{currency(avgBase)}</td>
                <td className="py-2.5 px-3 text-slate-600">{compAvg ? currency(compAvg) : '—'}</td>
                <td className="py-2.5 px-3 text-right">
                  <Link to={`/trips?route=${route.id}`} className="text-xs text-brand-600 hover:underline whitespace-nowrap">
                    View pricing →
                  </Link>
                </td>
              </tr>
            )
          })}
        </Table>
      </Card>
    </div>
  )
}
