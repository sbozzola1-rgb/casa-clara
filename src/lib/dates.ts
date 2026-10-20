export function parseDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

export function formatISO(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayISO(date = new Date()): string {
  return formatISO(date)
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

export function addMonthsClamped(date: Date, count: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + count, 1)
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), last))
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function parseMonthKey(key: string): { year: number; monthIndex: number } {
  const [year, month] = key.split('-').map(Number)
  return { year, monthIndex: month - 1 }
}

export function shiftMonth(key: string, delta: number): string {
  const { year, monthIndex } = parseMonthKey(key)
  return monthKey(new Date(year, monthIndex + delta, 1))
}

export function monthRange(key: string): { start: Date; end: Date } {
  const { year, monthIndex } = parseMonthKey(key)
  return {
    start: new Date(year, monthIndex, 1),
    end: new Date(year, monthIndex + 1, 0),
  }
}

export function monthTitle(key: string): string {
  const { year, monthIndex } = parseMonthKey(key)
  const label = new Date(year, monthIndex, 1).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function monthName(key: string): string {
  const { year, monthIndex } = parseMonthKey(key)
  return new Date(year, monthIndex, 1).toLocaleDateString('pt-BR', { month: 'long' })
}

export function clampDay(year: number, monthIndex: number, day: number): number {
  const last = new Date(year, monthIndex + 1, 0).getDate()
  return Math.min(Math.max(1, day), last)
}

export function dateOn(year: number, monthIndex: number, day: number): Date {
  return new Date(year, monthIndex, clampDay(year, monthIndex, day))
}

export function startOfWeek(date: Date): Date {
  const day = startOfDay(date)
  const weekday = day.getDay()
  const diff = weekday === 0 ? -6 : 1 - weekday
  return addDays(day, diff)
}

export function endOfWeek(date: Date): Date {
  return addDays(startOfWeek(date), 6)
}

export function inRange(date: Date, start: Date, end: Date): boolean {
  const time = startOfDay(date).getTime()
  return time >= startOfDay(start).getTime() && time <= startOfDay(end).getTime()
}

export function parseDay(value: string): number | null {
  if (!/^\d{1,2}$/.test(value.trim())) return null
  const day = Number(value)
  if (!Number.isInteger(day) || day < 1 || day > 31) return null
  return day
}

export function formatShort(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '')
}

export function formatFriendly(iso: string, today = new Date()): string {
  const date = parseDate(iso)
  const diff = Math.round((startOfDay(date).getTime() - startOfDay(today).getTime()) / 86_400_000)
  if (diff === 0) return 'Hoje'
  if (diff === -1) return 'Ontem'
  if (diff === 1) return 'Amanhã'
  return formatShort(date)
}

export function weekTitle(start: Date): string {
  const end = addDays(start, 6)
  const sameMonth = start.getMonth() === end.getMonth()
  if (sameMonth) {
    const month = end.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
    return `${start.getDate()}–${end.getDate()} ${month}`
  }
  return `${formatShort(start)} – ${formatShort(end)}`
}

export function dueTone(due: Date, today: Date, paid: boolean): 'paid' | 'overdue' | 'soon' | 'open' {
  if (paid) return 'paid'
  const distance = startOfDay(due).getTime() - startOfDay(today).getTime()
  if (distance < 0) return 'overdue'
  if (distance <= 3 * 86_400_000) return 'soon'
  return 'open'
}
