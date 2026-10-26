import { addMonthsClamped, parseDate, startOfWeek } from '../src/lib/dates.ts'
import { additionalApplies, billingMonthForDue, companyInMonth, fuelGoal, groceryGoal, installmentSchedule, invoiceDueDate, invoiceForCard, invoiceMonthFor, limitUsed, monthFlow, monthReport, overdueItems, spendEntries, spentInRange } from '../src/lib/finance.ts'
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
assert(limitUsed(card, state, today) === 700, 'limite soma à vista e todas as parcelas em aberto')
const afterDue = parseDate('2026-11-11')
assert(limitUsed(card, state, afterDue) === 700, 'fatura vencida e não paga continua no limite')
const paidNovember = stateWith([mercado, parcelado], { 'card-1:2026-11': true })
assert(limitUsed(card, paidNovember, today) === 200, 'fatura paga libera o que estava nela')
assert(limitUsed(card, paidNovember, afterDue) === 200, 'fatura paga continua fora do limite depois do vencimento')

const grocery = spentInRange(state, 'mercado', parseDate('2026-10-01'), parseDate('2026-10-31'))
assert(grocery.total === 400, 'compra à vista entra inteira no mês')
const airbnb = stateWith([purchase({ id: 'airbnb', date: '2026-09-05', amount: 1305.24, installments: 6, category: 'lazer' })])
const setembro = spentInRange(airbnb, 'lazer', parseDate('2026-09-01'), parseDate('2026-09-30'))
assert(setembro.total === 217.54, 'parcelado entra só com a parcela do mês')
assert(setembro.entries[0]?.detail.endsWith('parcela 1 de 6'), 'a lista identifica a parcela')
assert(spentInRange(airbnb, 'lazer', parseDate('2026-10-01'), parseDate('2026-10-31')).total === 217.54, 'a parcela seguinte cai no mês seguinte')

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

const school = {
  ...emptyState(),
  fixedExpenses: [{ id: 'escola', name: 'Escola', amount: 800, dueDay: 5, startDate: '2026-11-01', category: 'Escola', icon: 'escola' as const, notes: '', active: true }],
}
assert(monthReport(school, '2026-10').fixedTotal === 0, 'fixo não entra antes da data inicial')
assert(monthReport(school, '2026-11').fixedTotal === 800, 'fixo entra no mês da data inicial')

const fine = {
  ...emptyState(),
  fixedExpenses: [{ id: 'imposto', name: 'Imposto', amount: 100, dueDay: 10, startDate: null, category: 'Outro', icon: 'outro' as const, notes: '', active: true }],
  paidFixed: { 'imposto:2026-10': true as const },
  fixedSurcharges: { 'imposto:2026-10': 15 },
}
assert(monthReport(fine, '2026-10').fixedTotal === 115 && monthReport(fine, '2026-10').fixedPaid === 115, 'juros e multa entram no mês em que foram pagos')
assert(monthReport(fine, '2026-11').fixedTotal === 100 && monthReport(fine, '2026-11').fixedOpen === 100, 'o mês seguinte volta ao valor fixo')
assert(monthFlow(fine, '2026-10').expense === 115, 'juros e multa saem da conta só naquele mês')

const course = {
  ...emptyState(),
  additionalExpenses: [{ id: 'curso', name: 'Curso', amount: 200, dueDay: 10, startDate: '2026-10-01', endDate: '2026-12-10', notes: '' }],
}
assert(monthReport(course, '2026-09').additionalTotal === 0, 'adicional não entra antes de começar')
assert(monthReport(course, '2026-10').additionalTotal === 200 && monthReport(course, '2026-12').additionalTotal === 200, 'adicional entra do mês inicial ao final')
assert(monthReport(course, '2027-01').additionalTotal === 0, 'adicional sai depois da data final')
assert(monthFlow(course, '2026-11').expense === 200, 'adicional sai da conta, sem cartão')
const coursePaid = { ...course, paidAdditional: { 'curso:2026-11': true as const } }
assert(monthReport(coursePaid, '2026-11').additionalOpen === 0 && monthReport(coursePaid, '2026-11').stillOpen === 0, 'marcar adicional como pago tira do em aberto')
assert(monthReport(coursePaid, '2026-11').outflow === 200, 'adicional pago continua na saída do mês')
const courseFine = { ...coursePaid, additionalSurcharges: { 'curso:2026-11': 12.5 } }
assert(monthReport(courseFine, '2026-11').additionalTotal === 212.5 && monthReport(courseFine, '2026-11').additionalPaid === 212.5, 'juros do adicional entram só no mês pago')
assert(monthReport(courseFine, '2026-10').additionalTotal === 200, 'outro mês do adicional fica no principal')
assert(monthFlow(courseFine, '2026-11').expense === 212.5, 'juros do adicional saem da conta naquele mês')
assert(!additionalApplies(course.additionalExpenses[0], '2027-01'), 'depois do fim o adicional não vale mais')
const schoolLate = overdueItems(school, parseDate('2026-12-20'))
assert(!schoolLate.some((item) => item.month === '2026-10'), 'fixo não fica vencido antes de começar')
assert(schoolLate.some((item) => item.month === '2026-11' && item.expenseId === 'escola'), 'fixo vencido conta a partir do mês inicial')

const rentOnCard = {
  ...emptyState(),
  cards: [card],
  fixedExpenses: [{ id: 'aluguel', name: 'Aluguel', amount: 800, dueDay: 10, startDate: null, category: 'Aluguel', icon: 'casa' as const, notes: '', active: true }],
  paidFixed: { 'aluguel:2026-10': true as const },
  purchases: [{ id: 'fixed:aluguel:2026-10', cardId: 'card-1', description: 'Aluguel', amount: 800, installments: 1, date: '2026-10-10', category: 'outro' }],
}
assert(monthReport(rentOnCard, '2026-10').fixedPaid === 800, 'fixo no cartão continua pago na lista')
assert(monthFlow(rentOnCard, '2026-10').expense === 0, 'fixo pago no cartão não sai de novo no mês')
assert(invoiceForCard(card, rentOnCard.purchases, 2026, 10, {}).total === 800, 'fixo pago no cartão entra na fatura')
assert(monthFlow(rentOnCard, '2026-11').expense === 1600, 'o mês seguinte soma o fixo daquele mês e a fatura do pagamento anterior')

const companyCard = {
  ...emptyState(),
  cards: [card],
  companyEntries: [
    {
      id: 'fornecedor-cartao',
      direction: 'saida' as const,
      description: 'Fornecedor',
      amount: 300,
      date: '2026-10-20',
      category: 'Fornecedor',
      method: 'cartao' as const,
      cardId: 'card-1',
      installments: 1,
    },
  ],
}
assert(monthFlow(companyCard, '2026-10').expense === 0, 'saída no cartão não soma de novo em outubro')
assert(invoiceForCard(card, [], 2026, 10, {}, companyCard.companyEntries).total === 300, 'saída da empresa entra na fatura de novembro')
const linkedPurchase = purchase({ id: 'ja-no-cartao', date: '2026-10-20', amount: 300 })
const linked = {
  ...companyCard,
  purchases: [linkedPurchase],
  companyEntries: [{ ...companyCard.companyEntries[0], purchaseId: 'ja-no-cartao' }],
}
assert(invoiceForCard(card, linked.purchases, 2026, 10, {}, linked.companyEntries).total === 300, 'compra vinculada não entra duas vezes na fatura')

const recurring = {
  ...emptyState(),
  cards: [card],
  companyEntries: [{ id: 'saas', direction: 'saida' as const, description: 'Cursor', amount: 120, date: '2026-10-03', category: 'Serviço', method: 'cartao' as const, cardId: 'card-1', installments: 1, purchaseId: null, repeat: 'monthly' as const }],
}
assert(companyInMonth(recurring, '2026-09').saidas === 0, 'recorrente não volta para antes da data')
assert(companyInMonth(recurring, '2026-10').saidas === 120 && companyInMonth(recurring, '2026-12').saidas === 120, 'recorrente aparece no mês inicial e nos seguintes')
assert(invoiceForCard(card, [], 2026, 8, {}, recurring.companyEntries).total === 0, 'recorrente não entra na fatura anterior')
assert(invoiceForCard(card, [], 2026, 9, {}, recurring.companyEntries).total === 120, 'recorrente entra na fatura do mês inicial')
assert(invoiceForCard(card, [], 2026, 10, {}, recurring.companyEntries).total === 120, 'recorrente entra na fatura do mês seguinte')
assert(limitUsed(card, recurring, parseDate('2026-10-20')) === 240, 'recorrente ocupa o limite até a fatura aberta')
const recurringPaid = { ...recurring, paidInvoices: { 'card-1:2026-10': true as const } }
assert(limitUsed(card, recurringPaid, parseDate('2026-10-20')) === 120, 'fatura paga libera a ocorrência daquele mês')
const recurringFine = { ...recurringPaid, invoiceSurcharges: { 'card-1:2026-10': 8 } }
assert(monthReport(recurringFine, '2026-10').invoiceTotal === 128 && monthReport(recurringFine, '2026-10').invoicePaid === 128, 'juros da fatura entram no mês pago')
assert(monthFlow(recurringFine, '2026-10').expense === 128, 'juros da fatura saem da conta naquele mês')

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
const paidWithVale = {
  ...withVale,
  cashExpenses: [
    { id: 'horti', description: 'Hortifruti', amount: 80, date: '2026-10-20', category: 'mercado' as const, method: 'pix' as const, inflowId: 'vale' },
    { id: 'feira', description: 'Feira', amount: 30, date: '2026-10-21', category: 'mercado' as const, method: 'pix' as const, inflowId: null },
  ],
}
assert(spentInRange(paidWithVale, 'mercado', parseDate('2026-10-01'), parseDate('2026-10-31')).total === 110, 'compra com vale entra na meta')
assert(monthReport(paidWithVale, '2026-10').cashTotal === 30, 'compra com vale não sai do salário')
assert(spendEntries(paidWithVale, 'mercado').find((entry) => entry.id === 'horti')?.detail === 'Vale alimentação', 'a lista mostra o vale')

const withFuel = {
  ...emptyState(),
  goals: { ...emptyState().goals, fuelMonthlyDefault: 600, fuelByMonth: { '2026-11': 700 } },
  cashExpenses: [{ id: 'posto', description: 'Posto', amount: 180, date: '2026-10-20', category: 'combustivel' as const, method: 'pix' as const, inflowId: null }],
}
assert(fuelGoal(withFuel, '2026-10').amount === 600, 'combustível de outubro usa a meta padrão')
assert(fuelGoal(withFuel, '2026-11').amount === 700, 'combustível de novembro usa o ajuste do mês')

const portoDue = billingMonthForDue('2026-11', 29, 7)
assert(portoDue.year === 2026 && portoDue.monthIndex === 9, 'vencimento em novembro usa o fechamento de outubro')
const itauDue = billingMonthForDue('2026-10', 14, 21)
assert(itauDue.year === 2026 && itauDue.monthIndex === 9, 'vencimento no mesmo mês do fechamento permanece em outubro')
assert(spentInRange(withFuel, 'combustivel', parseDate('2026-10-01'), parseDate('2026-10-31')).total === 180, 'abastecimento entra no mês da data')

console.log('finanças ok')
