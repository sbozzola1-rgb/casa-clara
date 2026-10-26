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

export function companyOccursInMonth(entry: { date: string; repeat?: 'once' | 'monthly' }, month: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) return false
  if (entry.repeat !== 'monthly') {
    const { start, end } = monthRange(month)
    return inRange(parseDate(entry.date), start, end)
  }
  const { year, monthIndex } = parseMonthKey(month)
  const when = parseDate(entry.date)
  const start = when.getFullYear() * 12 + when.getMonth()
  const target = year * 12 + monthIndex
  return target >= start
}

export function companyOccurrenceDate(entry: { date: string; repeat?: 'once' | 'monthly' }, month: string): string {
  if (entry.repeat !== 'monthly') return entry.date
  const { year, monthIndex } = parseMonthKey(month)
  return formatISO(dateOn(year, monthIndex, parseDate(entry.date).getDate()))
}

function monthlyChargeOnBill(entry: CompanyEntry, year: number, monthIndex: number, closingDay: number): string | null {
  if (entry.repeat !== 'monthly') return null
  const day = parseDate(entry.date).getDate()
  const previous = new Date(year, monthIndex - 1, 1)
  const candidates = [dateOn(year, monthIndex, day), dateOn(previous.getFullYear(), previous.getMonth(), day)]
  for (const when of candidates) {
    const bill = invoiceMonthFor(when, closingDay)
    if (bill.year !== year || bill.monthIndex !== monthIndex) continue
    const month = monthKey(when)
    if (!companyOccursInMonth(entry, month)) continue
    return formatISO(when)
  }
  return null
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

export function fixedCardPurchaseId(expenseId: string, month: string): string {
  return `fixed:${expenseId}:${month}`
}

export function fixedPaymentFromPurchase(id: string): { expenseId: string; month: string } | null {
  const match = /^fixed:([^:]+):(\d{4}-\d{2})$/.exec(id)
  if (!match) return null
  return { expenseId: match[1], month: match[2] }
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
  for (const entry of companyEntries) {
    if (!companyOnCard(entry) || entry.cardId !== card.id || entry.repeat !== 'monthly') continue
    const when = monthlyChargeOnBill(entry, year, monthIndex, card.closingDay)
    if (!when) continue
    const linked = purchases.find((item) => item.id === entry.purchaseId)
    if (linked && linked.date.slice(0, 7) === when.slice(0, 7)) continue
    lines.push({
      purchaseId: entry.id,
      description: entry.description,
      category: entry.category,
      date: when,
      amount: entry.amount,
      installment: 1,
      installments: 1,
    })
  }
  const sources: Purchase[] = [
    ...purchases,
    ...companyEntries.filter((entry) => companyOnCard(entry) && entry.cardId === card.id && entry.repeat !== 'monthly' && !purchases.some((item) => item.id === entry.purchaseId)).map((entry) => ({
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
      total += installment.amount
    }
  }
  const openBill = openInvoiceMonth(today, card.closingDay)
  const openIndex = openBill.year * 12 + openBill.monthIndex
  for (const entry of state.companyEntries) {
    if (!companyOnCard(entry) || entry.cardId !== card.id) continue
    if (entry.repeat === 'monthly') {
      const start = parseDate(entry.date)
      let cursor = start.getFullYear() * 12 + start.getMonth()
      while (cursor <= openIndex + 1) {
        const year = Math.floor(cursor / 12)
        const monthIndex = cursor % 12
        const month = monthKey(new Date(year, monthIndex, 1))
        if (companyOccursInMonth(entry, month)) {
          const when = parseDate(companyOccurrenceDate(entry, month))
          const bill = invoiceMonthFor(when, card.closingDay)
          const billIndex = bill.year * 12 + bill.monthIndex
          const linked = state.purchases.find((item) => item.id === entry.purchaseId)
          const samePurchaseMonth = linked && linked.date.slice(0, 7) === month
          if (!samePurchaseMonth && billIndex <= openIndex && !state.paidInvoices[invoiceKey(card.id, bill.year, bill.monthIndex)]) total += entry.amount
        }
        cursor += 1
      }
      continue
    }
    if (state.purchases.some((item) => item.id === entry.purchaseId)) continue
    for (const installment of installmentSchedule({ amount: entry.amount, installments: entry.installments, date: entry.date })) {
      const bill = invoiceMonthFor(installment.date, card.closingDay)
      if (state.paidInvoices[invoiceKey(card.id, bill.year, bill.monthIndex)]) continue
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
    .flatMap((purchase) => {
      const card = state.cards.find((item) => item.id === purchase.cardId)
      return installmentSchedule(purchase).map((installment) => ({
        id: purchase.id,
        source: 'card' as const,
        description: purchase.description,
        amount: installment.amount,
        date: formatISO(installment.date),
        category,
        detail: installment.total > 1
          ? `${card?.nickname ?? 'Cartão'} · parcela ${installment.index} de ${installment.total}`
          : `${card?.nickname ?? 'Cartão'} · à vista`,
        cardId: purchase.cardId,
        installment: installment.index,
      }))
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
    for (const installment of installmentSchedule(purchase)) {
      if (!inRange(installment.date, start, end)) continue
      totals.set(purchase.category, round2((totals.get(purchase.category) ?? 0) + installment.amount))
    }
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
  additionalTotal: number
  additionalPaid: number
  additionalOpen: number
  invoiceTotal: number
  invoicePaid: number
  invoiceOpen: number
  cashTotal: number
  outflow: number
  stillOpen: number
}

export interface OverdueItem {
  key: string
  kind: 'fixed' | 'additional' | 'invoice'
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

function monthSerial(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const when = parseDate(date)
  return when.getFullYear() * 12 + when.getMonth()
}

export function additionalKey(id: string, month: string) {
  return `${id}:${month}`
}

export function additionalApplies(expense: { startDate: string; endDate: string }, month: string): boolean {
  const start = monthSerial(expense.startDate)
  const end = monthSerial(expense.endDate)
  if (start == null || end == null || end < start) return false
  const { year, monthIndex } = parseMonthKey(month)
  const target = year * 12 + monthIndex
  return target >= start && target <= end
}

function storedSurcharge(map: Record<string, number> | undefined, key: string): number {
  const amount = map?.[key] ?? 0
  return amount > 0 ? round2(amount) : 0
}

export function fixedSurcharge(state: AppState, expenseId: string, month: string): number {
  return storedSurcharge(state.fixedSurcharges, fixedKey(expenseId, month))
}

export function additionalSurcharge(state: AppState, expenseId: string, month: string): number {
  return storedSurcharge(state.additionalSurcharges, additionalKey(expenseId, month))
}

export function additionalMonthAmount(expense: { id: string; amount: number }, state: AppState, month: string): number {
  return round2(expense.amount + additionalSurcharge(state, expense.id, month))
}

export function invoiceSurcharge(state: AppState, cardId: string, year: number, monthIndex: number): number {
  return storedSurcharge(state.invoiceSurcharges, invoiceKey(cardId, year, monthIndex))
}

export function invoiceMonthAmount(invoice: { cardId: string; year: number; monthIndex: number; total: number }, state: AppState): number {
  return round2(invoice.total + invoiceSurcharge(state, invoice.cardId, invoice.year, invoice.monthIndex))
}

export function fixedMonthAmount(expense: { id: string; amount: number }, state: AppState, month: string): number {
  return round2(expense.amount + fixedSurcharge(state, expense.id, month))
}

export function fixedApplies(expense: { active: boolean; startDate?: string | null }, month: string): boolean {
  if (!expense.active) return false
  if (!expense.startDate || !/^\d{4}-\d{2}-\d{2}$/.test(expense.startDate)) return true
  const when = parseDate(expense.startDate)
  const { year, monthIndex } = parseMonthKey(month)
  const start = when.getFullYear() * 12 + when.getMonth()
  const target = year * 12 + monthIndex
  return target >= start
}

export function overdueItems(state: AppState, today: Date): OverdueItem[] {
  const todayStart = startOfDay(today).getTime()
  const items: OverdueItem[] = []
  for (let shift = -5; shift <= 0; shift += 1) {
    const ref = new Date(today.getFullYear(), today.getMonth() + shift, 1)
    const key = monthKey(ref)
    const { year, monthIndex } = parseMonthKey(key)
    for (const expense of state.fixedExpenses) {
      if (!fixedApplies(expense, key) || expense.amount <= 0 || state.paidFixed[fixedKey(expense.id, key)]) continue
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
    for (const expense of state.additionalExpenses ?? []) {
      if (!additionalApplies(expense, key) || expense.amount <= 0 || state.paidAdditional?.[additionalKey(expense.id, key)]) continue
      const due = dateOn(year, monthIndex, expense.dueDay)
      if (startOfDay(due).getTime() >= todayStart) continue
      items.push({
        key: `additional:${expense.id}:${key}`,
        kind: 'additional',
        title: expense.name,
        detail: 'Gasto adicional',
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
  const active = state.fixedExpenses.filter((expense) => fixedApplies(expense, month))
  const amountOf = (expense: { id: string; amount: number }) => fixedMonthAmount(expense, state, month)
  const fixedTotal = round2(active.reduce((sum, expense) => sum + amountOf(expense), 0))
  const fixedPaid = round2(
    active.reduce((sum, expense) => sum + (state.paidFixed[fixedKey(expense.id, month)] ? amountOf(expense) : 0), 0),
  )
  const invoices = invoicesDueInMonth(state, month)
  const invoiceTotal = round2(invoices.reduce((sum, invoice) => sum + invoiceMonthAmount(invoice, state), 0))
  const invoicePaid = round2(invoices.reduce((sum, invoice) => sum + (invoice.paid ? invoiceMonthAmount(invoice, state) : 0), 0))
  const { start, end } = monthRange(month)
  const cashTotal = round2(
    state.cashExpenses
      .filter((expense) => !expense.inflowId && inRange(parseDate(expense.date), start, end))
      .reduce((sum, expense) => sum + expense.amount, 0),
  )
  const onCard = round2(
    active.reduce(
      (sum, expense) => sum + (state.purchases.some((item) => item.id === fixedCardPurchaseId(expense.id, month)) ? amountOf(expense) : 0),
      0,
    ),
  )
  const extras = (state.additionalExpenses ?? []).filter((expense) => additionalApplies(expense, month))
  const extraAmount = (expense: { id: string; amount: number }) => additionalMonthAmount(expense, state, month)
  const additionalTotal = round2(extras.reduce((sum, expense) => sum + extraAmount(expense), 0))
  const additionalPaid = round2(
    extras.reduce((sum, expense) => sum + (state.paidAdditional?.[additionalKey(expense.id, month)] ? extraAmount(expense) : 0), 0),
  )
  const outflow = round2(fixedTotal - onCard + additionalTotal + invoiceTotal + cashTotal)
  return {
    fixedTotal,
    fixedPaid,
    fixedOpen: round2(fixedTotal - fixedPaid),
    additionalTotal,
    additionalPaid,
    additionalOpen: round2(additionalTotal - additionalPaid),
    invoiceTotal,
    invoicePaid,
    invoiceOpen: round2(invoiceTotal - invoicePaid),
    cashTotal,
    outflow,
    stillOpen: round2(fixedTotal - fixedPaid + (additionalTotal - additionalPaid) + (invoiceTotal - invoicePaid)),
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
  const entries = state.companyEntries.filter((entry) => companyOccursInMonth(entry, month))
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
    companyCash,
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
