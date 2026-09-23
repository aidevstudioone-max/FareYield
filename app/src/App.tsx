import React from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import RoutesPage from './pages/RoutesPage'
import Trips from './pages/Trips'
import TripDetail from './pages/TripDetail'
import SeatPricing from './pages/SeatPricing'
import Simulator from './pages/Simulator'
import PricingRules from './pages/PricingRules'
import Analytics from './pages/Analytics'
import SettingsPage from './pages/Settings'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/routes" element={<RoutesPage />} />
          <Route path="/trips" element={<Trips />} />
          <Route path="/trips/:id" element={<TripDetail />} />
          <Route path="/trips/:id/seats" element={<SeatPricing />} />
          <Route path="/simulator" element={<Simulator />} />
          <Route path="/rules" element={<PricingRules />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
