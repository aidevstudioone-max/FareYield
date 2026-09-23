// Local persistence layer. Everything reads/writes through the functions below,
// which is the intended swap seam: replace the bodies of load()/save() with real
// API calls (or point them at a backend + Postgres) once one exists. No other
// file in the app should touch localStorage directly.

const PREFIX = 'fyield:'
export const SCHEMA_VERSION = 2

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function save<T>(key: string, value: T): void {
  localStorage.setItem(PREFIX + key, JSON.stringify(value))
}

export function getAll<T>(collection: string): T[] {
  return load<T[]>(collection, [])
}

export function saveAll<T>(collection: string, items: T[]): void {
  save(collection, items)
}

export function upsert<T extends { id: string }>(collection: string, item: T): T {
  const items = getAll<T>(collection)
  const idx = items.findIndex((i) => i.id === item.id)
  if (idx >= 0) items[idx] = item
  else items.push(item)
  saveAll(collection, items)
  return item
}

export function remove(collection: string, id: string): void {
  const items = getAll<{ id: string }>(collection).filter((i) => i.id !== id)
  saveAll(collection, items)
}

export function genId(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function resetAll(reseed: () => void): void {
  Object.keys(localStorage)
    .filter((k) => k.startsWith(PREFIX))
    .forEach((k) => localStorage.removeItem(k))
  reseed()
  save('schema_version', SCHEMA_VERSION)
}

export function ensureSchemaVersion(reseed: () => void): void {
  const current = load<number>('schema_version', 0)
  if (current !== SCHEMA_VERSION) {
    resetAll(reseed)
  }
}

export const COLLECTIONS = {
  routes: 'routes',
  buses: 'buses',
  trips: 'trips',
  competitorFares: 'competitor_fares',
  dailyRevenue: 'daily_revenue',
  priceHistory: 'price_history',
  pricingConfig: 'pricing_config',
  settings: 'settings'
} as const
