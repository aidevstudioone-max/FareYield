import React, { useEffect, useRef, useState } from 'react'
import { computeRecommendation } from '../lib/pricingEngine'
import { currency } from '../lib/format'
import type { PricingConfig } from '../lib/types'

const WINDOW_MS = 24000
const TICK_MS = 650

interface Props {
  label: string
  sublabel: string
  basePrice: number
  baseOccupancy: number
  baseCompetitor: number
  daysToDeparture: number
  dateISO: string
  isHoliday: boolean
  popularity: number
  config: PricingConfig
}

interface Pt {
  time: number
  price: number
  demand: number
}

// Smoothly-wandering signal (sum of a few out-of-phase sine waves) rather than
// raw noise, so the live price genuinely drifts up and down like a real
// ticker instead of jittering randomly frame to frame.
function occupancyWave(t: number): number {
  return 6 * Math.sin(t / 5.3) + 3.5 * Math.sin(t / 2.1 + 1.4) + 1.8 * Math.sin(t / 0.9 + 0.6)
}
function competitorWave(t: number): number {
  return 0.06 * Math.sin(t / 7.7 + 2.2) + 0.03 * Math.sin(t / 3.1)
}

export default function LiveTicker({
  label,
  sublabel,
  basePrice,
  baseOccupancy,
  baseCompetitor,
  daysToDeparture,
  dateISO,
  isHoliday,
  popularity,
  config
}: Props) {
  const startRef = useRef(performance.now())
  const lastTickRef = useRef(0)
  const pointsRef = useRef<Pt[]>([])
  const prevPriceRef = useRef(basePrice)
  const rafRef = useRef<number>()
  const [, tick] = useState(0)
  const [current, setCurrent] = useState<{ price: number; demand: number; dir: 'up' | 'down' | 'flat' }>({
    price: basePrice,
    demand: 50,
    dir: 'flat'
  })

  useEffect(() => {
    function loop(now: number) {
      if (now - lastTickRef.current >= TICK_MS) {
        lastTickRef.current = now
        const t = (now - startRef.current) / 1000
        const occupancyPct = Math.max(2, Math.min(99, baseOccupancy + occupancyWave(t)))
        const competitorAvg = baseCompetitor * (1 + competitorWave(t))
        const rec = computeRecommendation(
          { occupancyPct, daysToDeparture, dateISO, isHoliday, basePrice, competitorAvg, popularity },
          config
        )
        const pts = pointsRef.current
        pts.push({ time: now, price: rec.recommendedPrice, demand: rec.demandScore })
        while (pts.length && now - pts[0].time > WINDOW_MS) pts.shift()

        const dir = rec.recommendedPrice > prevPriceRef.current ? 'up' : rec.recommendedPrice < prevPriceRef.current ? 'down' : 'flat'
        prevPriceRef.current = rec.recommendedPrice
        setCurrent({ price: rec.recommendedPrice, demand: rec.demandScore, dir })
      }
      tick((n) => (n + 1) % 1000000)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label])

  const now = performance.now()
  const pts = pointsRef.current
  const W = 100
  const H = 34
  const prices = [current.price, ...pts.map((p) => p.price)]
  const rawMax = Math.max(...prices)
  const rawMin = Math.min(...prices)
  // Scale to the live series' own volatility (padded) rather than always
  // stretching to the base fare, so small live swings stay visible even when
  // the recommended price sits far above or below the static base fare.
  const pad = Math.max((rawMax - rawMin) * 0.35, rawMax * 0.015, 4)
  const maxP = rawMax + pad
  const minP = rawMin - pad
  const span = maxP - minP || 1

  const xFor = (time: number) => W - ((now - time) / WINDOW_MS) * W
  const yFor = (price: number) => H - ((price - minP) / span) * (H - 4) - 2

  const linePoints = pts.map((p) => `${xFor(p.time).toFixed(2)},${yFor(p.price).toFixed(2)}`).join(' ')
  const areaPoints =
    pts.length > 1 ? `${xFor(pts[0].time).toFixed(2)},${H} ${linePoints} ${xFor(pts[pts.length - 1].time).toFixed(2)},${H}` : ''
  const baseY = yFor(basePrice)
  const last = pts[pts.length - 1]

  const dirColor = current.dir === 'up' ? '#34d399' : current.dir === 'down' ? '#f87171' : '#94a3b8'
  const dirArrow = current.dir === 'up' ? '▲' : current.dir === 'down' ? '▼' : '–'
  const deltaPct = ((current.price - basePrice) / basePrice) * 100

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 text-white relative overflow-hidden">
      <div
        className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, #6366f1, transparent 70%)' }}
      />
      <div className="relative flex items-center justify-between mb-3 flex-wrap gap-y-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative w-2 h-2 rounded-full bg-red-500 shrink-0 ticker-dot" />
          <span className="text-[10px] font-bold tracking-[0.15em] text-red-400 uppercase shrink-0">Live</span>
          <span className="text-sm text-slate-200 font-medium truncate">{label}</span>
        </div>
        <span className="text-[11px] text-slate-500 truncate">{sublabel}</span>
      </div>

      <div className="relative flex items-end justify-between mb-1 flex-wrap gap-3">
        <div>
          <div
            key={current.price}
            className="text-3xl sm:text-4xl font-bold font-display tabular-nums leading-none"
            style={{ color: dirColor, animation: 'tickerFlash .45s ease' }}
          >
            {currency(current.price)}
          </div>
          <div className="text-xs mt-1.5 font-medium" style={{ color: dirColor }}>
            {dirArrow} {deltaPct >= 0 ? '+' : ''}
            {deltaPct.toFixed(1)}% vs base fare {currency(basePrice)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-slate-500 uppercase tracking-wide">Live demand</div>
          <div className="text-lg font-semibold text-slate-100">
            {current.demand}
            <span className="text-slate-500 text-sm">/100</span>
          </div>
        </div>
      </div>

      <div className="relative mt-2">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="110" preserveAspectRatio="none" className="overflow-visible block">
          <defs>
            <linearGradient id="tickerFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#818cf8" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1={0} x2={W} y1={baseY} y2={baseY} stroke="#475569" strokeWidth={0.25} strokeDasharray="1.4,1.4" vectorEffect="non-scaling-stroke" />
          {pts.length > 1 && <polygon points={areaPoints} fill="url(#tickerFill)" stroke="none" />}
          {pts.length > 1 && (
            <polyline
              points={linePoints}
              fill="none"
              stroke="#a5b4fc"
              strokeWidth={0.55}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {last && <circle cx={xFor(last.time)} cy={yFor(last.price)} r={1.3} fill={dirColor} />}
        </svg>
        <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
          <span>−24s</span>
          <span className="text-slate-500">base fare ·· ·· ··</span>
          <span>now</span>
        </div>
      </div>

      <div className="relative text-[10px] text-slate-600 mt-2">
        Simulated live market signal, run through the real pricing engine — not a live booking feed.
      </div>
    </div>
  )
}
