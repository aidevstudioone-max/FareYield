# FareYield

> Dynamic pricing for bus operators, explained.

A sellable demo of a **dynamic pricing / yield-management engine** for intercity bus
operators — the same idea behind airline and RedBus-style surge pricing, applied to
bus fleets. Single-page React app, **no backend**. All data lives in the browser's
`localStorage` and is seeded from a realistic dataset on first load. Every read /
write goes through `src/lib/db.ts`, which is the intended swap seam for a real API
layer later.

## Run locally

```bash
cd app
npm install
npm run dev        # http://localhost:8190
```

## What's inside

- **Dashboard** — revenue KPIs, dynamic-vs-static revenue trend, price alerts, demand mix
- **Routes & Fleet** — every route the engine prices, its bus mix, competitor fares
- **Live Pricing** — every upcoming departure with the engine's recommendation next to
  the fare currently shown to customers, with a "needs review" filter
- **Trip Detail** — a full factor breakdown (occupancy, urgency, day-type, competitor,
  seasonality) with plain-English reasoning for *why* a price is what it is, apply/
  override controls, and a projected price curve to departure
- **Simulator** — a sandbox to tune inputs (occupancy, days to departure, competitor
  price, popularity, holiday flag) and watch the recommendation update live
- **Pricing Rules** — configure the algorithm mode, elasticity, price floor/ceiling and
  the relative weight of each demand signal
- **Analytics** — 60-day dynamic-vs-static revenue comparison, demand-mix breakdown,
  route performance table

## The pricing engine

`app/src/lib/pricingEngine.ts` scores every trip's demand 0–100 from five normalized
signals — seat occupancy, time-to-departure urgency, day-type/holidays, competitor
price gap, and seasonality — weighted by a configurable `PricingConfig`. The score maps
through an elasticity curve to a price multiplier, clamped to a floor/ceiling. Every
recommendation carries a full factor breakdown and human-readable reasoning, which is
the product's core "why this price" idea.

It's a deterministic, fully explainable simulated model rather than a trained ML
model — appropriate for a static demo with no backend to host real inference on, and
it keeps every price fully explainable rather than a black box.

## Stack

React 18 · TypeScript · Vite · Tailwind · React Router (HashRouter) · lucide-react.
Mobile-first and fully responsive. Charts are dependency-free inline SVG.

## Deploy (GitHub Pages, project site)

`app/vite.config.ts` uses `base: '/FareYield/'` for production builds. The build is
emitted to `dist-site/` and `index.html` + `assets/` are copied to the repo root
(committed) so Pages serves it from the root of the branch:

```bash
cd app && npm run build
cd .. && rm -rf assets && cp -r dist-site/assets assets && cp dist-site/index.html index.html
```
