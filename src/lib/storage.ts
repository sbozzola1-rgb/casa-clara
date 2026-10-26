import { emptyState, CARD_COLORS, COMPANY_CATEGORIES, COMPANY_PAYMENTS, FIXED_ICONS, iconForCategory, PAYMENT_METHODS, PEOPLE, SPEND_CATEGORIES, type AppState, type CardColorId, type CompanyDirection, type CompanyPayment, type CustomCategory, type FixedIconId, type AdditionalExpense, type GroceryInflow, type HouseTask, type IncomeSource, type LeisurePlan, type PaymentMethod, type Person, type SavingPot, type TaskAssignee, type TaskTag } from './types.ts'

const KEY = 'casa-clara.v1'
const spendIds = new Set<string>(SPEND_CATEGORIES.map((item) => item.id))
const methodIds = new Set<string>(PAYMENT_METHODS.map((item) => item.id))
const colorIds = new Set<string>(CARD_COLORS.map((item) => item.id))
const personIds = new Set<string>(PEOPLE.map((item) => item.id))
const fixedIconIds = new Set<string>(FIXED_ICONS.map((item) => item.id))
const companyCategories = new Set<string>(COMPANY_CATEGORIES)
const companyPayments = new Set<string>(COMPANY_PAYMENTS.map((item) => item.id))

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

function readGroceryInflows(value: unknown): GroceryInflow[] {
  if (!Array.isArray(value)) return []
  const items: GroceryInflow[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string') continue
    const amount = numberOrNull(item.amount)
    const month = text(item.month)
    if (amount == null || amount <= 0 || !/^\d{4}-\d{2}$/.test(month)) continue
    items.push({
      id: item.id,
      name: text(item.name).trim() || 'Vale alimentação',
      amount,
      month,
      repeat: item.repeat === 'once' ? 'once' : 'monthly',
    })
  }
  return items
}

function readCustomCategories(value: unknown): CustomCategory[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const items: CustomCategory[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string') continue
    const name = text(item.name).trim()
    if (!name || seen.has(item.id)) continue
    seen.add(item.id)
    items.push({ id: item.id, name })
  }
  return items
}

function readFixedSurcharges(value: unknown): Record<string, number> {
  const amounts: Record<string, number> = {}
  if (!value || typeof value !== 'object') return amounts
  for (const [key, amountValue] of Object.entries(value)) {
    if (!/^[^:]+:\d{4}-\d{2}$/.test(key)) continue
    const amount = numberOrNull(amountValue)
    if (amount != null && amount > 0) amounts[key] = amount
  }
  return amounts
}

function readMonthAmounts(value: unknown): Record<string, number> {
  const amounts: Record<string, number> = {}
  if (!value || typeof value !== 'object') return amounts
  for (const [key, amountValue] of Object.entries(value)) {
    if (!/^\d{4}-\d{2}$/.test(key)) continue
    const amount = numberOrNull(amountValue)
    if (amount != null) amounts[key] = amount
  }
  return amounts
}

export function sanitize(input: unknown): AppState | null {
  if (!input || typeof input !== 'object') return null
  const source = input as Partial<AppState> & { monthlyIncome?: unknown }
  const base = emptyState()
  const goals = source.goals && typeof source.goals === 'object' ? source.goals : base.goals
  const groceryByMonth = readMonthAmounts(goals.groceryByMonth)
  const fuelByMonth = readMonthAmounts(goals.fuelByMonth)
  const customCategories = readCustomCategories(source.customCategories)
  const customIds = new Set(customCategories.map((item) => item.id))
  const groceryInflows = readGroceryInflows(source.groceryInflows)
  const taskTags = readTaskTags(source.taskTags)

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
            const method = text(item.method)
            const payment = (companyPayments.has(method) ? method : 'pix') as CompanyPayment
            const cardId = direction === 'saida' && payment === 'cartao' ? text(item.cardId) : ''
            return [
              {
                id: item.id,
                direction: direction as CompanyDirection,
                description: text(item.description).trim() || (direction === 'entrada' ? 'Entrada' : 'Saída'),
                amount,
                date: /^\d{4}-\d{2}-\d{2}$/.test(text(item.date)) ? text(item.date) : '2026-01-01',
                category: companyCategories.has(category) ? category : 'Outro',
                method: payment === 'cartao' && direction === 'saida' && cardId.length === 0 ? 'pix' : payment,
                cardId: cardId.length > 0 ? cardId : null,
                installments: cardId.length > 0 ? Math.min(24, Math.max(1, Math.round(Number(item.installments)) || 1)) : 1,
                purchaseId: text(item.purchaseId).trim() || null,
                repeat: item.repeat === 'monthly' ? 'monthly' : 'once',
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
              startDate: /^\d{4}-\d{2}-\d{2}$/.test(text(item.startDate)) ? text(item.startDate) : null,
              category,
              icon: (fixedIconIds.has(icon) ? icon : iconForCategory(category)) as FixedIconId,
              notes: text(item.notes),
              active: item.active !== false,
            }
          })
      : [],
    additionalExpenses: readAdditional(source.additionalExpenses),
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
            category: spendIds.has(text(item.category)) || customIds.has(text(item.category)) ? text(item.category) : 'outro',
          }))
      : [],
    cashExpenses: Array.isArray(source.cashExpenses)
      ? source.cashExpenses
          .filter((item) => item && typeof item === 'object' && typeof item.id === 'string')
          .flatMap((item) => {
            const category = text(item.category)
            if (category !== 'mercado' && category !== 'lazer' && category !== 'combustivel') return []
            return [
              {
                id: item.id,
                description: text(item.description).trim() || 'Lançamento',
                amount: numberOrNull(item.amount) ?? 0,
                date: /^\d{4}-\d{2}-\d{2}$/.test(text(item.date)) ? text(item.date) : '2026-01-01',
                category,
                method: (methodIds.has(text(item.method)) ? item.method : 'pix') as PaymentMethod,
                inflowId: text(item.inflowId).trim() || null,
              },
            ]
          })
      : [],
    groceryInflows,
    paidFixed: flagMap(source.paidFixed),
    fixedSurcharges: readFixedSurcharges(source.fixedSurcharges),
    paidAdditional: flagMap(source.paidAdditional),
    paidInvoices: flagMap(source.paidInvoices),
    goals: {
      leisureWeeklyMax: numberOrNull(goals.leisureWeeklyMax),
      groceryMonthlyDefault: numberOrNull(goals.groceryMonthlyDefault),
      groceryByMonth,
      fuelMonthlyDefault: numberOrNull(goals.fuelMonthlyDefault),
      fuelByMonth,
    },
    customCategories,
    savings: readSavings(source.savings),
    leisurePlans: readLeisurePlans(source.leisurePlans),
    taskTags,
    tasks: readTasks(source.tasks, taskTags),
  }
}

function readSavings(value: unknown): SavingPot[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string') return []
    const name = text(item.name).trim()
    const target = numberOrNull(item.target)
    const saved = numberOrNull(item.saved) ?? 0
    if (!name || target == null || target <= 0) return []
    return [{ id: item.id, name, target, saved }]
  })
}

function readAdditional(value: unknown): AdditionalExpense[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string') return []
    const name = text(item.name).trim()
    const amount = numberOrNull(item.amount)
    const startDate = text(item.startDate)
    const endDate = text(item.endDate)
    if (!name || amount == null || amount <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return []
    return [{
      id: item.id,
      name,
      amount,
      dueDay: Math.min(31, Math.max(1, Math.round(Number(item.dueDay)) || 1)),
      startDate,
      endDate,
      notes: text(item.notes).trim(),
    }]
  })
}

function readLeisurePlans(value: unknown): LeisurePlan[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string') return []
    const name = text(item.name).trim()
    const date = text(item.date)
    const amount = numberOrNull(item.amount)
    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(date) || amount == null || amount <= 0) return []
    return [{ id: item.id, name, date, amount, note: text(item.note).trim() }]
  })
}

function readTaskTags(value: unknown): TaskTag[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string') return []
    const name = text(item.name).trim()
    const key = name.toLowerCase()
    if (!name || seen.has(key)) return []
    seen.add(key)
    return [{ id: item.id, name }]
  })
}

function readTasks(value: unknown, tags: TaskTag[]): HouseTask[] {
  if (!Array.isArray(value)) return []
  const tagIds = new Set(tags.map((tag) => tag.id))
  const assignees = new Set<TaskAssignee>(['sara', 'vinicius', 'ambos'])
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string') return []
    const title = text(item.title).trim()
    if (!title) return []
    const due = text(item.dueDate)
    const assignee = text(item.assignee)
    const rawTags = Array.isArray(item.tagIds) ? item.tagIds : []
    const kept: string[] = []
    for (const id of rawTags) {
      if (typeof id === 'string' && tagIds.has(id) && !kept.includes(id)) kept.push(id)
    }
    return [{
      id: item.id,
      title,
      note: text(item.note).trim(),
      done: item.done === true,
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null,
      assignee: assignees.has(assignee as TaskAssignee) ? (assignee as TaskAssignee) : null,
      tagIds: kept,
    }]
  })
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
