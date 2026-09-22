export function currency(n: number): string {
  const v = Math.round(n || 0)
  return `₹${v.toLocaleString('en-IN')}`
}

export function currencyK(n: number): string {
  const v = n || 0
  if (Math.abs(v) >= 10000000) return `₹${(v / 10000000).toFixed(2)}Cr`
  if (Math.abs(v) >= 100000) return `₹${(v / 100000).toFixed(2)}L`
  if (Math.abs(v) >= 1000) return `₹${(v / 1000).toFixed(1)}k`
  return `₹${Math.round(v)}`
}

export function num(n: number): string {
  return (n || 0).toLocaleString('en-IN')
}

export function pct(n: number, digits = 0): string {
  return `${(n || 0).toFixed(digits)}%`
}

export function fmtDate(d: string): string {
  if (!d) return '-'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return d
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtDateShort(d: string): string {
  if (!d) return '-'
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return d
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

export function fmtWeekday(d: string): string {
  const dt = new Date(d)
  return dt.toLocaleDateString('en-IN', { weekday: 'short' })
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function addDaysISO(days: number, from?: string): string {
  const d = from ? new Date(from) : new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function daysBetween(a: string, b: string): number {
  const A = new Date(a).setHours(0, 0, 0, 0)
  const B = new Date(b).setHours(0, 0, 0, 0)
  return Math.round((B - A) / 86400000)
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}
