import { addMonthsClamped, dateOn, formatISO, inRange, monthKey, monthName, monthRange, parseDate, parseMonthKey, startOfDay } from './dates.ts'
import { round2 } from './money.ts'
import { categoryLabel, methodLabel, type AppState, type BudgetCategory, type CompanyEntry, type CreditCard, type Purchase, type SpendEntry } from './types.ts'

export interface Installment {
  index: number
  total: number
  date: Date
  amount: number
}

export function companyOnCard(entry: CompanyEntry): boolean {
  return entry.direction === 'saida' && entry.method === 'cartao' && Boolean(entry.cardId)
}

export interface InvoiceLine {
  purchaseId: string
  description: string
  category: string
  date: string
  amount: number
  installment: number
  installments: number
}

export interface Invoice {
  cardId: string
  lines: InvoiceLine[]
  total: number
  closing: Date
  due: Date
  year: number
  monthIndex: number
  paid: boolean
}

export function invoiceKey(cardId: string, year: number, monthIndex: number): string {
  return `${cardId}:${monthKey(new Date(year, monthIndex, 1))}`
}

export function fixedKey(expenseId: string, month: string): string {
  return `${expenseId}:${month}`
}

export function invoiceMonthFor(date: Date, closingDay: number): { year: number; monthIndex: number } {
  const closing = dateOn(date.getFullYear(), date.getMonth(), closingDay)
  if (date.getDate() <= closing.getDate()) {
    return { year: date.getFullYear(), monthIndex: date.getMonth() }
  }
  const next = new Date(date.getFullYear(), date.getMonth() + 1, 1)
  return { year: next.getFullYear(), monthIndex: next.getMonth() }
}

export function invoiceDueDate(year: number, monthIndex: number, closingDay: number, dueDay: number): Date {
  if (dueDay > closingDay) return dateOn(year, monthIndex, dueDay)
  const next = new Date(year, monthIndex + 1, 1)
  return dateOn(next.getFullYear(), next.getMonth(), dueDay)
}

export function billingMonthForDue(dueMonth: string, closingDay: number, dueDay: number): { year: number; monthIndex: number } {
  const { year, monthIndex } = parseMonthKey(dueMonth)
  if (dueDay > closingDay) return { year, monthIndex }
  const previous = new Date(year, monthIndex - 1, 1)
  return { year: previous.getFullYear(), monthIndex: previous.getMonth() }
}

export function openInvoiceMonth(today: Date, closingDay: number): { year: number; monthIndex: number } {
  return invoiceMonthFor(today, closingDay)
}

export function installmentSchedule(purchase: Pick<Purchase, 'amount' | 'installments' | 'date'>): Installment[] {
  const total = Math.min(24, Math.max(1, Math.round(purchase.installments) || 1))
  const base = parseDate(purchase.date)
  const portion = round2(purchase.amount / total)
  let allocated = 0
  const items: Installment[] = []
  for (let index = 0; index < total; index += 1) {
    const amount = index === total - 1 ? round2(purchase.amount - allocated) : portion
    allocated = round2(allocated + amount)
    items.push({
      index: index + 1,
      total,
      date: addMonthsClamped(base, index),
      amount,
    })
  }
  return items
}

export function invoiceForCard(
  card: CreditCard,
  purchases: Purchase[],
  year: number,
  monthIndex: number,
  paidInvoices: Record<string, true>,
  companyEntries: CompanyEntry[] = [],
): Invoice {
  const lines: InvoiceLine[] = []
  const sources: Purchase[] = [
    ...purchases,
    ...companyEntries.filter((entry) => companyOnCard(entry) && entry.cardId === card.id).map((entry) => ({
      id: entry.id,
      cardId: entry.cardId ?? '',
      description: entry.description,
      amount: entry.amount,
      installments: entry.installments,
      date: entry.date,
      category: 'outro' as const,
    })),
  ]
  for (const purchase of sources) {
    if (purchase.cardId !== card.id) continue
    const company = companyEntries.find((entry) => entry.id === purchase.id)
    for (const installment of installmentSchedule(purchase)) {
      const bill = invoiceMonthFor(installment.date, card.closingDay)
      if (bill.year !== year || bill.monthIndex !== monthIndex) continue
      lines.push({
        purchaseId: purchase.id,
        description: purchase.description,
        category: company?.category ?? purchase.category,
        date: formatISO(installment.date),
        amount: installment.amount,
        installment: installment.index,
        installments: installment.total,
      })
    }
  }
  lines.sort((a, b) => a.date.localeCompare(b.date) || a.description.localeCompare(b.description))
  return {
    cardId: card.id,
    lines,
    total: round2(lines.reduce((sum, line) => sum + line.amount, 0)),
    closing: dateOn(year, monthIndex, card.closingDay),
    due: invoiceDueDate(year, monthIndex, card.closingDay, card.dueDay),
    year,
    monthIndex,
    paid: Boolean(paidInvoices[invoiceKey(card.id, year, monthIndex)]),
  }
}

export function invoicesDueInMonth(state: AppState, month: string): Invoice[] {
  const { year, monthIndex } = parseMonthKey(month)
  const invoices: Invoice[] = []
  for (const card of state.cards) {
    for (const shift of [-1, 0, 1]) {
      const ref = new Date(year, monthIndex + shift, 1)
      const due = invoiceDueDate(ref.getFullYear(), ref.getMonth(), card.closingDay, card.dueDay)
      if (due.getFullYear() !== year || due.getMonth() !== monthIndex) continue
      invoices.push(invoiceForCard(card, state.purchases, ref.getFullYear(), ref.getMonth(), state.paidInvoices, state.companyEntries))
    }
  }
  return invoices.sort((a, b) => a.due.getTime() - b.due.getTime())
}

export function limitUsed(card: CreditCard, state: AppState, today: Date): number {
  let total = 0
  for (const purchase of state.purchases) {
    if (purchase.cardId !== card.id) continue
    for (const installment of installmentSchedule(purchase)) {
      const bill = invoiceMonthFor(installment.date, card.closingDay)
      if (state.paidInvoices[invoiceKey(card.id, bill.year, bill.monthIndex)]) continue
      const due = invoiceDueDate(bill.year, bill.monthIndex, card.closingDay, card.dueDay)
      if (startOfDay(due).getTime() < startOfDay(today).getTime()) continue
      total += installment.amount
    }
  }
  for (const entry of state.companyEntries) {
    if (!companyOnCard(entry) || entry.cardId !== card.id) continue
    for (const installment of installmentSchedule({ amount: entry.amount, installments: entry.installments, date: entry.date })) {
      const bill = invoiceMonthFor(installment.date, card.closingDay)
      if (state.paidInvoices[invoiceKey(card.id, bill.year, bill.monthIndex)]) continue
      const due = invoiceDueDate(bill.year, bill.monthIndex, card.closingDay, card.dueDay)
      if (startOfDay(due).getTime() < startOfDay(today).getTime()) continue
      total += installment.amount
    }
  }
  return round2(total)
}

export function groceryInflowApplies(item: { month: string; repeat: 'monthly' | 'once' }, month: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(item.month)) return false
  if (item.repeat === 'once') return item.month === month
  return item.month <= month
}

export function groceryGoal(state: AppState, month: string): { amount: number | null; override: boolean; base: number | null; inflowTotal: number } {
  const override = Object.prototype.hasOwnProperty.call(state.goals.groceryByMonth, month)
  const base = override ? (state.goals.groceryByMonth[month] ?? null) : state.goals.groceryMonthlyDefault
  const inflowTotal = round2(
    (state.groceryInflows ?? [])
      .filter((item) => groceryInflowApplies(item, month))
      .reduce((sum, item) => sum + item.amount, 0),
  )
  const amount = base == null && inflowTotal <= 0 ? null : round2((base ?? 0) + inflowTotal)
  return { amount, override, base, inflowTotal }
}

export function fuelGoal(state: AppState, month: string): { amount: number | null; override: boolean } {
  const byMonth = state.goals.fuelByMonth ?? {}
  if (Object.prototype.hasOwnProperty.call(byMonth, month)) {
    return { amount: byMonth[month] ?? null, override: true }
  }
  return { amount: state.goals.fuelMonthlyDefault ?? null, override: false }
}

export function spendEntries(state: AppState, category: BudgetCategory): SpendEntry[] {
  const fromCards: SpendEntry[] = state.purchases
    .filter((purchase) => purchase.category === category)
    .map((purchase) => {
      const card = state.cards.find((item) => item.id === purchase.cardId)
      const parcels = purchase.installments > 1 ? `${purchase.installments}x` : 'à vista'
      return {
        id: purchase.id,
        source: 'card' as const,
        description: purchase.description,
        amount: purchase.amount,
        date: purchase.date,
        category,
        detail: `${card?.nickname ?? 'Cartão'} · ${parcels}`,
        cardId: purchase.cardId,
      }
    })
  const fromCash: SpendEntry[] = state.cashExpenses
    .filter((expense) => expense.category === category)
    .map((expense) => ({
      id: expense.id,
      source: 'cash' as const,
      description: expense.description,
      amount: expense.amount,
      date: expense.date,
      category,
      detail: expense.inflowId
        ? (state.groceryInflows.find((item) => item.id === expense.inflowId)?.name ?? 'Fonte de entrada')
        : methodLabel(expense.method),
    }))
  return [...fromCards, ...fromCash].sort((a, b) => b.date.localeCompare(a.date) || a.description.localeCompare(b.description))
}

export function spentInRange(state: AppState, category: BudgetCategory, start: Date, end: Date) {
  const entries = spendEntries(state, category).filter((entry) => inRange(parseDate(entry.date), start, end))
  return {
    entries,
    total: round2(entries.reduce((sum, entry) => sum + entry.amount, 0)),
  }
}

export interface CategorySlice {
  id: string
  label: string
  amount: number
}

export function variableSpending(state: AppState, month: string): CategorySlice[] {
  const { start, end } = monthRange(month)
  const totals = new Map<string, number>()
  for (const purchase of state.purchases) {
    if (!inRange(parseDate(purchase.date), start, end)) continue
    totals.set(purchase.category, round2((totals.get(purchase.category) ?? 0) + purchase.amount))
  }
  for (const expense of state.cashExpenses) {
    if (!inRange(parseDate(expense.date), start, end)) continue
    totals.set(expense.category, round2((totals.get(expense.category) ?? 0) + expense.amount))
  }
  return [...totals.entries()]
    .map(([id, amount]) => ({ id, label: categoryLabel(id, state.customCategories ?? []), amount }))
    .sort((a, b) => b.amount - a.amount)
}

export interface MonthReport {
  fixedTotal: number
  fixedPaid: number
  fixedOpen: number
  invoiceTotal: number
  invoicePaid: number
  invoiceOpen: number
  cashTotal: number
  outflow: number
  stillOpen: number
}

export interface OverdueItem {
  key: string
  kind: 'fixed' | 'invoice'
  title: string
  detail: string
  icon?: string
  amount: number
  due: Date
  month: string
  expenseId?: string
  cardId?: string
  year?: number
  monthIndex?: number
}

export function overdueItems(state: AppState, today: Date): OverdueItem[] {
  const todayStart = startOfDay(today).getTime()
  const items: OverdueItem[] = []
  for (let shift = -5; shift <= 0; shift += 1) {
    const ref = new Date(today.getFullYear(), today.getMonth() + shift, 1)
    const key = monthKey(ref)
    const { year, monthIndex } = parseMonthKey(key)
    for (const expense of state.fixedExpenses) {
      if (!expense.active || expense.amount <= 0 || state.paidFixed[fixedKey(expense.id, key)]) continue
      const due = dateOn(year, monthIndex, expense.dueDay)
      if (startOfDay(due).getTime() >= todayStart) continue
      items.push({
        key: `fixed:${expense.id}:${key}`,
        kind: 'fixed',
        title: expense.name,
        detail: expense.category,
        icon: expense.icon,
        amount: expense.amount,
        due,
        month: key,
        expenseId: expense.id,
      })
    }
    for (const invoice of invoicesDueInMonth(state, key)) {
      if (invoice.paid || invoice.total <= 0 || startOfDay(invoice.due).getTime() >= todayStart) continue
      const card = state.cards.find((item) => item.id === invoice.cardId)
      items.push({
        key: `invoice:${invoice.cardId}:${invoice.year}-${invoice.monthIndex}`,
        kind: 'invoice',
        title: `Fatura ${card?.nickname ?? 'cartão'}`,
        detail: 'Fatura',
        amount: invoice.total,
        due: invoice.due,
        month: key,
        cardId: invoice.cardId,
        year: invoice.year,
        monthIndex: invoice.monthIndex,
      })
    }
  }
  return items.sort((a, b) => a.due.getTime() - b.due.getTime() || a.title.localeCompare(b.title))
}

export function attentionCount(state: AppState, today: Date): number {
  return overdueItems(state, today).length
}

export function monthReport(state: AppState, month: string): MonthReport {
  const active = state.fixedExpenses.filter((expense) => expense.active)
  const fixedTotal = round2(active.reduce((sum, expense) => sum + expense.amount, 0))
  const fixedPaid = round2(
    active.reduce((sum, expense) => sum + (state.paidFixed[fixedKey(expense.id, month)] ? expense.amount : 0), 0),
  )
  const invoices = invoicesDueInMonth(state, month)
  const invoiceTotal = round2(invoices.reduce((sum, invoice) => sum + invoice.total, 0))
  const invoicePaid = round2(invoices.reduce((sum, invoice) => sum + (invoice.paid ? invoice.total : 0), 0))
  const { start, end } = monthRange(month)
  const cashTotal = round2(
    state.cashExpenses
      .filter((expense) => !expense.inflowId && inRange(parseDate(expense.date), start, end))
      .reduce((sum, expense) => sum + expense.amount, 0),
  )
  const outflow = round2(fixedTotal + invoiceTotal + cashTotal)
  return {
    fixedTotal,
    fixedPaid,
    fixedOpen: round2(fixedTotal - fixedPaid),
    invoiceTotal,
    invoicePaid,
    invoiceOpen: round2(invoiceTotal - invoicePaid),
    cashTotal,
    outflow,
    stillOpen: round2(fixedTotal - fixedPaid + (invoiceTotal - invoicePaid)),
  }
}

export function incomeApplies(item: { date: string | null; repeat: 'monthly' | 'once' }, month: string): boolean {
  if (!item.date) return item.repeat !== 'once'
  const { year, monthIndex } = parseMonthKey(month)
  const when = parseDate(item.date)
  if (item.repeat === 'once') return when.getFullYear() === year && when.getMonth() === monthIndex
  const start = when.getFullYear() * 12 + when.getMonth()
  const target = year * 12 + monthIndex
  return target >= start
}

export function peopleIncome(state: AppState, month: string) {
  const active = state.incomes.filter((item) => incomeApplies(item, month))
  const sara = round2(active.filter((item) => item.person === 'sara').reduce((sum, item) => sum + item.amount, 0))
  const vinicius = round2(active.filter((item) => item.person === 'vinicius').reduce((sum, item) => sum + item.amount, 0))
  return { sara, vinicius, total: round2(sara + vinicius) }
}

export function companyInMonth(state: AppState, month: string) {
  const { start, end } = monthRange(month)
  const entries = state.companyEntries.filter((entry) => inRange(parseDate(entry.date), start, end))
  const entradas = round2(entries.filter((entry) => entry.direction === 'entrada').reduce((sum, entry) => sum + entry.amount, 0))
  const saidas = round2(entries.filter((entry) => entry.direction === 'saida').reduce((sum, entry) => sum + entry.amount, 0))
  return { entries, entradas, saidas }
}

export function monthFlow(state: AppState, month: string) {
  const people = peopleIncome(state, month)
  const company = companyInMonth(state, month)
  const report = monthReport(state, month)
  const income = round2(people.total + company.entradas)
  const companyCash = round2(
    company.entries
      .filter((entry) => entry.direction === 'saida' && !companyOnCard(entry))
      .reduce((sum, entry) => sum + entry.amount, 0),
  )
  const expense = round2(report.outflow + companyCash)
  return {
    people,
    company,
    report,
    income,
    expense,
    leftover: round2(income - expense),
    hasIncome: state.incomes.length > 0 || company.entradas > 0,
  }
}

export function flowSeries(state: AppState, endMonth: string, count = 6) {
  const { year, monthIndex } = parseMonthKey(endMonth)
  return Array.from({ length: count }, (_, index) => {
    const shift = index - (count - 1)
    const key = monthKey(new Date(year, monthIndex + shift, 1))
    const flow = monthFlow(state, key)
    return {
      month: key,
      label: monthName(key).slice(0, 3),
      income: flow.income,
      expense: flow.expense,
    }
  })
}

export function grocerySeries(state: AppState, endMonth: string, count = 6) {
  const { year, monthIndex } = parseMonthKey(endMonth)
  return Array.from({ length: count }, (_, index) => {
    const shift = index - (count - 1)
    const key = monthKey(new Date(year, monthIndex + shift, 1))
    const range = monthRange(key)
    const spent = spentInRange(state, 'mercado', range.start, range.end).total
    const goal = groceryGoal(state, key).amount
    const name = monthName(key)
    return { month: key, label: name.slice(0, 3), spent, goal }
  })
}

export function fuelSeries(state: AppState, endMonth: string, count = 6) {
  const { year, monthIndex } = parseMonthKey(endMonth)
  return Array.from({ length: count }, (_, index) => {
    const shift = index - (count - 1)
    const key = monthKey(new Date(year, monthIndex + shift, 1))
    const range = monthRange(key)
    const spent = spentInRange(state, 'combustivel', range.start, range.end).total
    const goal = fuelGoal(state, key).amount
    return { month: key, label: monthName(key).slice(0, 3), spent, goal }
  })
}

export function leisureSeries(state: AppState, endWeekStart: Date, count = 8) {
  return Array.from({ length: count }, (_, index) => {
    const shift = index - (count - 1)
    const start = new Date(endWeekStart.getFullYear(), endWeekStart.getMonth(), endWeekStart.getDate() + shift * 7)
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)
    return {
      start,
      label: String(start.getDate()),
      spent: spentInRange(state, 'lazer', start, end).total,
      cap: state.goals.leisureWeeklyMax,
    }
  })
}
