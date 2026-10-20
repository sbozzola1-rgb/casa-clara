import { emptyState, CARD_COLORS, COMPANY_CATEGORIES, FIXED_ICONS, iconForCategory, PAYMENT_METHODS, PEOPLE, SPEND_CATEGORIES, type AppState, type CardColorId, type CompanyDirection, type FixedIconId, type GroceryInflow, type IncomeSource, type PaymentMethod, type Person, type SpendingCategory } from './types.ts'

const KEY = 'casa-clara.v1'
const spendIds = new Set<string>(SPEND_CATEGORIES.map((item) => item.id))
const methodIds = new Set<string>(PAYMENT_METHODS.map((item) => item.id))
const colorIds = new Set<string>(CARD_COLORS.map((item) => item.id))
const personIds = new Set<string>(PEOPLE.map((item) => item.id))
const fixedIconIds = new Set<string>(FIXED_ICONS.map((item) => item.id))
const companyCategories = new Set<string>(COMPANY_CATEGORIES)

function numberOrNull(value: unknown): number | null {
  if (value == null || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.round(parsed * 100) / 100
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function flagMap(value: unknown): Record<string, true> {
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(Object.keys(value).map((key) => [key, true as const]))
}

function readIncomes(source: { incomes?: unknown; monthlyIncome?: unknown }): IncomeSource[] {
  if (Array.isArray(source.incomes)) {
    const parsed = source.incomes
      .filter((item) => item && typeof item === 'object' && typeof item.id === 'string')
      .flatMap((item) => {
        const amount = numberOrNull(item.amount)
        const person = text(item.person)
        if (amount == null || amount <= 0 || !personIds.has(person)) return []
        const rawDate = text(item.date)
        return [
          {
            id: item.id,
            person: person as Person,
            name: text(item.name).trim() || 'Renda',
            amount,
            date: /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : null,
            repeat: item.repeat === 'once' ? 'once' as const : 'monthly' as const,
          },
        ]
      })
    if (parsed.length > 0) return parsed
  }
  const legacy = numberOrNull(source.monthlyIncome)
  if (legacy != null && legacy > 0) {
    return [{ id: 'renda-inicial', person: 'sara', name: 'Renda da casa', amount: legacy, date: null, repeat: 'monthly' }]
  }
  return []
}

export function sanitize(input: unknown): AppState | null {
  if (!input || typeof input !== 'object') return null
  const source = input as Partial<AppState> & { monthlyIncome?: unknown }
  const base = emptyState()
  const goals = source.goals && typeof source.goals === 'object' ? source.goals : base.goals
  const groceryByMonth: Record<string, number> = {}
  if (goals.groceryByMonth && typeof goals.groceryByMonth === 'object') {
    for (const [key, value] of Object.entries(goals.groceryByMonth)) {
      if (!/^\d{4}-\d{2}$/.test(key)) continue
      const amount = numberOrNull(value)
      if (amount != null) groceryByMonth[key] = amount
    }
  }

  return {
    version: 1,
    incomes: readIncomes(source),
    companyEntries: Array.isArray(source.companyEntries)
      ? source.companyEntries
          .filter((item) => item && typeof item === 'object' && typeof item.id === 'string')
          .flatMap((item) => {
            const amount = numberOrNull(item.amount)
            const direction = text(item.direction)
            if (amount == null || amount <= 0 || (direction !== 'entrada' && direction !== 'saida')) return []
            const category = text(item.category, 'Outro')
            return [
              {
                id: item.id,
                direction: direction as CompanyDirection,
                description: text(item.description).trim() || (direction === 'entrada' ? 'Entrada' : 'Saída'),
                amount,
                date: /^\d{4}-\d{2}-\d{2}$/.test(text(item.date)) ? text(item.date) : '2026-01-01',
                category: companyCategories.has(category) ? category : 'Outro',
              },
            ]
          })
      : [],
    fixedExpenses: Array.isArray(source.fixedExpenses)
      ? source.fixedExpenses
          .filter((item) => item && typeof item === 'object' && typeof item.id === 'string')
          .map((item) => {
            const category = text(item.category, 'Outro')
            const icon = text(item.icon)
            return {
              id: item.id,
              name: text(item.name).trim() || 'Gasto fixo',
              amount: numberOrNull(item.amount) ?? 0,
              dueDay: Math.min(31, Math.max(1, Math.round(Number(item.dueDay)) || 1)),
              category,
              icon: (fixedIconIds.has(icon) ? icon : iconForCategory(category)) as FixedIconId,
              notes: text(item.notes),
              active: item.active !== false,
            }
          })
      : [],
    cards: Array.isArray(source.cards)
      ? source.cards
          .filter((item) => item && typeof item === 'object' && typeof item.id === 'string')
          .map((item) => ({
            id: item.id,
            nickname: text(item.nickname).trim() || 'Cartão',
            lastFour: text(item.lastFour).replace(/\D/g, '').slice(0, 4),
            limit: numberOrNull(item.limit) ?? 0,
            closingDay: Math.min(31, Math.max(1, Math.round(Number(item.closingDay)) || 1)),
            dueDay: Math.min(31, Math.max(1, Math.round(Number(item.dueDay)) || 10)),
            color: (colorIds.has(text(item.color)) ? item.color : 'forest') as CardColorId,
          }))
      : [],
    purchases: Array.isArray(source.purchases)
      ? source.purchases
          .filter((item) => item && typeof item === 'object' && typeof item.id === 'string' && typeof item.cardId === 'string')
          .map((item) => ({
            id: item.id,
            cardId: item.cardId,
            description: text(item.description).trim() || 'Compra',
            amount: numberOrNull(item.amount) ?? 0,
            installments: Math.min(24, Math.max(1, Math.round(Number(item.installments)) || 1)),
            date: /^\d{4}-\d{2}-\d{2}$/.test(text(item.date)) ? text(item.date) : '2026-01-01',
            category: (spendIds.has(text(item.category)) ? item.category : 'outro') as SpendingCategory,
          }))
      : [],
    cashExpenses: Array.isArray(source.cashExpenses)
      ? source.cashExpenses
          .filter((item) => item && typeof item === 'object' && typeof item.id === 'string')
          .flatMap((item) => {
            const category = text(item.category)
            if (category !== 'mercado' && category !== 'lazer') return []
            return [
              {
                id: item.id,
                description: text(item.description).trim() || 'Lançamento',
                amount: numberOrNull(item.amount) ?? 0,
                date: /^\d{4}-\d{2}-\d{2}$/.test(text(item.date)) ? text(item.date) : '2026-01-01',
                category,
                method: (methodIds.has(text(item.method)) ? item.method : 'pix') as PaymentMethod,
              },
            ]
          })
      : [],
    groceryInflows: Array.isArray(source.groceryInflows)
      ? source.groceryInflows
          .filter((item) => item && typeof item === 'object' && typeof item.id === 'string')
          .flatMap((item): GroceryInflow[] => {
            const amount = numberOrNull(item.amount)
            const month = text(item.month)
            if (amount == null || amount <= 0 || !/^\d{4}-\d{2}$/.test(month)) return []
            return [
              {
                id: item.id,
                name: text(item.name).trim() || 'Vale alimentação',
                amount,
                month,
                repeat: item.repeat === 'once' ? 'once' : 'monthly',
              },
            ]
          })
      : [],
    paidFixed: flagMap(source.paidFixed),
    paidInvoices: flagMap(source.paidInvoices),
    goals: {
      leisureWeeklyMax: numberOrNull(goals.leisureWeeklyMax),
      groceryMonthlyDefault: numberOrNull(goals.groceryMonthlyDefault),
      groceryByMonth,
    },
  }
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyState()
    return sanitize(JSON.parse(raw)) ?? emptyState()
  } catch {
    return emptyState()
  }
}

export function saveState(state: AppState): void {
  localStorage.setItem(KEY, JSON.stringify(state))
}
