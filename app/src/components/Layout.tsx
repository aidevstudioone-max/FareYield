import React, { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import * as Icons from 'lucide-react'
import { COLLECTIONS, load } from '../lib/db'

function Icon({ name, className, size = 17 }: { name: string; className?: string; size?: number }) {
  const Cmp = (Icons as any)[name] || Icons.Circle
  return <Cmp className={className} size={size} strokeWidth={2} />
}

const NAV = [
  { path: '/', label: 'Dashboard', icon: 'LayoutDashboard' },
  { path: '/routes', label: 'Routes & Fleet', icon: 'Map' },
  { path: '/trips', label: 'Live Pricing', icon: 'Zap' },
  { path: '/simulator', label: 'Simulator', icon: 'SlidersHorizontal' },
  { path: '/rules', label: 'Pricing Rules', icon: 'Settings2' },
  { path: '/analytics', label: 'Analytics', icon: 'BarChart3' },
  { path: '/settings', label: 'Settings', icon: 'Settings' }
]

const navItemCls = (isActive: boolean) =>
  `flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm nav-liquid ${
    isActive ? 'nav-liquid-active text-white' : 'text-slate-200 hover:text-white'
  }`

export default function Layout() {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const settings = load<{ companyName: string }>(COLLECTIONS.settings, { companyName: 'FareYield Transit Ops' })

  const sidebar = (
    <aside className="w-64 shrink-0 bg-slate-900 text-slate-200 flex flex-col h-full">
      <div className="h-14 flex items-center gap-2 px-4 border-b border-slate-800 shrink-0">
        <span className="text-xl">🚌</span>
        <span className="font-bold text-white text-sm leading-tight font-display">FareYield</span>
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-1.5">
        {NAV.map((item) => (
          <NavLink key={item.path} to={item.path} end={item.path === '/'} onClick={() => setOpen(false)} className={({ isActive }) => navItemCls(isActive)}>
            <Icon name={item.icon} />
            <span className="truncate">{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="px-3 py-2.5 border-t border-slate-800 text-[11px] text-slate-500 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 live-dot" />
        Demo data · pricing engine simulated
      </div>
    </aside>
  )

  const activeLabel = NAV.find((n) => (n.path === '/' ? pathname === '/' : pathname.startsWith(n.path)))?.label ?? 'Dashboard'

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800">
      <div className="hidden lg:block">{sidebar}</div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-0 h-full">{sidebar}</div>
        </div>
      )}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-5 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button className="lg:hidden text-slate-500" onClick={() => setOpen(true)}>
              <Icon name="Menu" />
            </button>
            <div className="text-sm text-slate-500 truncate">
              {settings.companyName} <span className="text-slate-300 hidden sm:inline">/ {activeLabel}</span>
            </div>
          </div>
          <Badge />
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function Badge() {
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium text-brand-700 bg-brand-50 border border-brand-100 rounded-full px-2.5 py-1">
      <Icons.Sparkles size={13} />
      ML_BLEND engine active
    </div>
  )
}
