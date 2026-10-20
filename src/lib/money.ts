export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatInput(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function parseMoney(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const normalized = trimmed.includes(',')
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : trimmed.replace(/\s/g, '')
  const value = Number(normalized)
  if (!Number.isFinite(value) || value < 0) return null
  return round2(value)
}

export function uid(): string {
  return crypto.randomUUID()
}
