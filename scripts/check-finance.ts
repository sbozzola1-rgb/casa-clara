import { addMonthsClamped, parseDate, startOfWeek } from '../src/lib/dates.ts'
import { groceryGoal, installmentSchedule, invoiceDueDate, invoiceForCard, invoiceMonthFor, limitUsed, monthFlow, overdueItems, spentInRange } from '../src/lib/finance.ts'
import { sanitize } from '../src/lib/storage.ts'
import { emptyState, type AppState, type CreditCard, type Purchase } from '../src/lib/types.ts'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

const card: CreditCard = {
  id: 'card-1',
  nickname: 'Nubank',
  lastFour: '1234',
  limit: 5000,
  closingDay: 5,
  dueDay: 10,
  color: 'forest',
}

function purchase(partial: Partial<Purchase> & Pick<Purchase, 'date' | 'amount'>): Purchase {
  return {
    id: partial.id ?? 'p1',
    cardId: 'card-1',
    description: partial.description ?? 'Compra',
    amount: partial.amount,
    installments: partial.installments ?? 1,
    date: partial.date,
    category: partial.category ?? 'outro',
  }
}

function stateWith(purchases: Purchase[], paidInvoices: Record<string, true> = {}): AppState {
  return { ...emptyState(), cards: [card], purchases, paidInvoices }
}

const octoberBill = invoiceMonthFor(parseDate('2026-10-03'), 5)
assert(octoberBill.year === 2026 && octoberBill.monthIndex === 9, 'compra no dia 3 entra na fatura de outubro')

const novemberBill = invoiceMonthFor(parseDate('2026-10-10'), 5)
assert(novemberBill.year === 2026 && novemberBill.monthIndex === 10, 'compra depois do fechamento vai para novembro')

const dueSameMonth = invoiceDueDate(2026, 9, 5, 10)
assert(dueSameMonth.getMonth() === 9 && dueSameMonth.getDate() === 10, 'vencimento depois do fechamento fica no mesmo mês')

const dueNextMonth = invoiceDueDate(2026, 9, 28, 5)
assert(dueNextMonth.getMonth() === 10 && dueNextMonth.getDate() === 5, 'vencimento antes do fechamento cai no mês seguinte')

const portions = installmentSchedule({ amount: 100, installments: 3, date: '2026-10-20' }).map((item) => item.amount)
assert(portions[0] === 33.33 && portions[1] === 33.33 && portions[2] === 33.34, 'parcelas fecham o valor cheio')

const february = addMonthsClamped(parseDate('2026-01-31'), 1)
assert(february.getMonth() === 1 && february.getDate() === 28, 'parcela de 31 de janeiro cai em 28 de fevereiro')

const mercado = purchase({ id: 'mercado', date: '2026-10-20', amount: 400, category: 'mercado' })
const parcelado = purchase({ id: 'tv', date: '2026-10-20', amount: 300, installments: 3, category: 'outro' })
const state = stateWith([mercado, parcelado])
const openInvoice = invoiceForCard(card, state.purchases, 2026, 10, {})
assert(openInvoice.total === 500, 'fatura de novembro soma mercado à vista e a primeira parcela')
assert(openInvoice.lines.some((line) => line.purchaseId === 'tv' && line.installment === 1 && line.amount === 100), 'primeira parcela da TV')

const december = invoiceForCard(card, state.purchases, 2026, 11, {})
assert(december.total === 100 && december.lines[0]?.installment === 2, 'segunda parcela vai para dezembro')

const today = parseDate('2026-10-20')
assert(limitUsed(card, state, today) === 700, 'limite soma as parcelas que ainda vão vencer')
const paidNovember = stateWith([mercado, parcelado], { 'card-1:2026-11': true })
assert(limitUsed(card, paidNovember, today) === 200, 'fatura paga libera o que estava nela')

const grocery = spentInRange(state, 'mercado', parseDate('2026-10-01'), parseDate('2026-10-31'))
assert(grocery.total === 400, 'meta de mercado usa o valor cheio no mês da compra')

const week = startOfWeek(parseDate('2026-10-20'))
assert(week.getDate() === 19 && week.getMonth() === 9, 'semana começa na segunda')

const household = {
  ...emptyState(),
  incomes: [
    { id: 'sara', person: 'sara' as const, name: 'Salário', amount: 6000 },
    { id: 'vinicius', person: 'vinicius' as const, name: 'Salário', amount: 4000 },
  ],
  companyEntries: [
    { id: 'venda', direction: 'entrada' as const, description: 'Cliente', amount: 800, date: '2026-10-10', category: 'Venda' },
    { id: 'fornecedor', direction: 'saida' as const, description: 'Fornecedor', amount: 500, date: '2026-10-15', category: 'Fornecedor' },
  ],
  fixedExpenses: [{ id: 'aluguel', name: 'Aluguel', amount: 2000, dueDay: 10, category: 'Aluguel', notes: '', active: true }],
}
const october = monthFlow(household, '2026-10')
assert(october.people.sara === 6000 && october.people.vinicius === 4000, 'renda separa Sara e Vinicius')
assert(october.income === 10800, 'entrada da empresa soma na renda da casa')

const dated = {
  ...emptyState(),
  incomes: [
    { id: 'once', person: 'sara' as const, name: 'Extra', amount: 300, date: '2026-11-02', repeat: 'once' as const },
    { id: 'month', person: 'vinicius' as const, name: 'Salário', amount: 1000, date: '2026-10-05', repeat: 'monthly' as const },
  ],
}
assert(monthFlow(dated, '2026-09').people.total === 0, 'renda mensal não volta para antes da data')
assert(monthFlow(dated, '2026-10').people.vinicius === 1000 && monthFlow(dated, '2026-10').people.sara === 0, 'outubro só tem o salário que já começou')
assert(monthFlow(dated, '2026-11').people.sara === 300 && monthFlow(dated, '2026-11').people.vinicius === 1000, 'extra entra só em novembro e o salário continua')
assert(october.expense === 2500, 'saída da empresa soma nos gastos da casa')

const late = overdueItems(household, parseDate('2026-10-20'))
assert(late.some((item) => item.expenseId === 'aluguel' && item.month === '2026-10'), 'aluguel de outubro vencido entra na gestão')
assert(late.filter((item) => item.expenseId === 'aluguel').length === 6, 'olha os últimos 6 meses')
const paid = overdueItems({ ...household, paidFixed: { 'aluguel:2026-10': true } }, parseDate('2026-10-20'))
assert(!paid.some((item) => item.month === '2026-10'), 'marcar como pago tira da lista')

const migrated = sanitize({ version: 1, monthlyIncome: 10000, fixedExpenses: [], cards: [], purchases: [], cashExpenses: [], paidFixed: {}, paidInvoices: {}, goals: {} })
assert(migrated?.incomes.length === 1 && migrated.incomes[0]?.person === 'sara' && migrated.incomes[0]?.amount === 10000, 'renda antiga vira origem da Sara')

const withVale = {
  ...emptyState(),
  goals: { ...emptyState().goals, groceryMonthlyDefault: 1500 },
  groceryInflows: [{ id: 'vale', name: 'Vale alimentação', amount: 400, month: '2026-10', repeat: 'once' as const }],
}
assert(groceryGoal(withVale, '2026-10').amount === 1900, 'vale alimentação compõe a meta de outubro')
assert(groceryGoal(withVale, '2026-11').amount === 1500, 'vale de um mês só não entra no seguinte')
const valeMensal = {
  ...withVale,
  groceryInflows: [{ id: 'vale', name: 'Vale alimentação', amount: 400, month: '2026-10', repeat: 'monthly' as const }],
}
assert(groceryGoal(valeMensal, '2026-11').amount === 1900, 'vale mensal continua nos meses seguintes')

console.log('finanças ok')
