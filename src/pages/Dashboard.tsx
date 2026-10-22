import { useState } from 'react'
import { IncomeDialog } from '../components/dialogs.tsx'
import { ExpenseMark } from '../components/ExpenseIcon.tsx'
import { BudgetMeter, Button, FlowChart, Panel, ToneBadge, toneLabel } from '../components/ui.tsx'
import { dateOn, dueTone, formatShort, monthRange, monthTitle, parseMonthKey, startOfWeek, weekTitle } from '../lib/dates.ts'
import { additionalApplies, additionalKey, fixedApplies, fixedCardPurchaseId, fixedKey, flowSeries, fuelGoal, groceryGoal, invoiceForCard, invoicesDueInMonth, limitUsed, monthFlow, openInvoiceMonth, overdueItems, spentInRange, variableSpending } from '../lib/finance.ts'
import { formatBRL, round2 } from '../lib/money.ts'
import { useStore } from '../state.tsx'

export function Dashboard() {
  const { state, month, today, setPage } = useStore()
  const [incomeOpen, setIncomeOpen] = useState(false)
  const flow = monthFlow(state, month)
  const report = flow.report
  const { year, monthIndex } = parseMonthKey(month)
  const weekStart = startOfWeek(today)
  const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6)
  const leisure = spentInRange(state, 'lazer', weekStart, weekEnd)
  const groceryRange = monthRange(month)
  const grocery = spentInRange(state, 'mercado', groceryRange.start, groceryRange.end)
  const goal = groceryGoal(state, month)
  const fuelSpent = spentInRange(state, 'combustivel', groceryRange.start, groceryRange.end)
  const fuel = fuelGoal(state, month)
  const slices = variableSpending(state, month)
  const peak = Math.max(1, ...slices.map((item) => item.amount))
  const leftover = flow.hasIncome ? flow.leftover : null
  const companyNet = round2(flow.company.entradas - flow.company.saidas)
  const fixedOnCard = round2(
    state.fixedExpenses
      .filter((expense) => fixedApplies(expense, month))
      .reduce((sum, expense) => sum + (state.purchases.some((item) => item.id === fixedCardPurchaseId(expense.id, month)) ? expense.amount : 0), 0),
  )
  const fixedCounted = round2(report.fixedTotal - fixedOnCard)
  const outflowPieces = [
    { label: 'Fixos', value: fixedCounted },
    { label: 'Adicionais', value: report.additionalTotal },
    { label: 'Cartões', value: report.invoiceTotal },
    { label: 'À vista', value: report.cashTotal },
    { label: 'Empresa, fora do cartão', value: flow.companyCash },
  ].filter((piece) => piece.value > 0)
  const openPieces = [
    { label: 'Fixos', value: report.fixedOpen },
    { label: 'Adicionais', value: report.additionalOpen },
    { label: 'Cartões', value: report.invoiceOpen },
  ].filter((piece) => piece.value > 0)
  const closeLine = leftover == null
    ? `Neste mês sai ${formatBRL(flow.expense)}`
    : leftover < 0
      ? `O mês fecha negativo em ${formatBRL(Math.abs(leftover))}`
      : leftover > 0
        ? `Sobra ${formatBRL(leftover)} se pagar tudo`
        : 'O mês fecha no zero'
  const late = overdueItems(state, today)
  const lateTotal = round2(late.reduce((sum, item) => sum + item.amount, 0))
  const series = flowSeries(state, month)
  const leisureOver = state.goals.leisureWeeklyMax != null && leisure.total > state.goals.leisureWeeklyMax
  const groceryOver = goal.amount != null && grocery.total > goal.amount
  const fuelOver = fuel.amount != null && fuelSpent.total > fuel.amount

  const dues = [
    ...state.fixedExpenses
      .filter((expense) => fixedApplies(expense, month))
      .map((expense) => {
        const due = dateOn(year, monthIndex, expense.dueDay)
        const paid = Boolean(state.paidFixed[fixedKey(expense.id, month)])
        const cardPaid = state.purchases.find((item) => item.id === fixedCardPurchaseId(expense.id, month))
        const cardName = state.cards.find((item) => item.id === cardPaid?.cardId)?.nickname
        return {
          id: expense.id,
          title: expense.name,
          detail: cardName ? `${expense.category} · ${cardName}` : expense.category,
          icon: expense.icon,
          amount: expense.amount,
          due,
          paid,
        }
      }),
    ...(state.additionalExpenses ?? [])
      .filter((expense) => additionalApplies(expense, month))
      .map((expense) => {
        const due = dateOn(year, monthIndex, expense.dueDay)
        return {
          id: expense.id,
          title: expense.name,
          detail: 'Gasto adicional',
          icon: undefined as string | undefined,
          amount: expense.amount,
          due,
          paid: Boolean(state.paidAdditional?.[additionalKey(expense.id, month)]),
        }
      }),
    ...invoicesDueInMonth(state, month).map((invoice) => {
      const card = state.cards.find((item) => item.id === invoice.cardId)
      return {
        id: `${invoice.cardId}-${invoice.year}-${invoice.monthIndex}`,
          title: `Fatura ${card?.nickname ?? 'cartão'}`,
          detail: `Fechou ${formatShort(invoice.closing)}`,
          icon: undefined as string | undefined,
          amount: invoice.total,
        due: invoice.due,
        paid: invoice.paid,
      }
    }),
  ]
    .filter((item) => item.amount > 0)
    .sort((a, b) => a.due.getTime() - b.due.getTime())

  const steps = [
    { done: state.incomes.length > 0, label: 'Renda da casa', hint: 'Sara e Vinicius, cada um com a sua origem', action: () => setIncomeOpen(true) },
    { done: state.fixedExpenses.length > 0, label: 'Gastos fixos', hint: 'Aluguel, luz, escola, internet', action: () => setPage({ id: 'fixed' }) },
    { done: state.cards.length > 0, label: 'Cartões', hint: 'Um cartão e as compras dele', action: () => setPage({ id: 'cards' }) },
    { done: state.goals.leisureWeeklyMax != null, label: 'Teto de lazer', hint: 'O máximo da semana', action: () => setPage({ id: 'goals' }) },
    { done: state.goals.groceryMonthlyDefault != null, label: 'Meta de mercado', hint: 'O alvo do mês, com ajuste quando precisar', action: () => setPage({ id: 'goals' }) },
    { done: state.goals.fuelMonthlyDefault != null, label: 'Meta de combustível', hint: 'O teto do mês para abastecer', action: () => setPage({ id: 'goals' }) },
  ]
  const pending = steps.filter((step) => !step.done)

  return (
    <div>
      <p className="text-xs font-semibold tracking-[0.16em] text-moss uppercase">Visão da casa</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl tracking-tight">{monthTitle(month)}</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
            Em destaque, o que ainda falta pagar. O fechamento do mês fica logo abaixo e olha tudo o que sai, pago ou não.
          </p>
        </div>
      </div>

      <section className="mt-6 rounded-3xl bg-night px-6 py-6 text-white md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.16em] text-white/60 uppercase">
              {report.stillOpen > 0 ? 'Quanto ainda falta pagar' : 'Nada falta pagar'}
            </p>
            <p className="mt-2 font-serif text-5xl tracking-tight tabular-nums">
              {formatBRL(report.stillOpen)}
            </p>
            {openPieces.length > 0 ? (
              <ul className="mt-4 max-w-sm space-y-1.5">
                {openPieces.map((piece) => (
                  <li key={piece.label} className="flex items-baseline justify-between gap-6 text-sm text-white/80">
                    <span>{piece.label}</span>
                    <span className="font-medium tabular-nums text-white">{formatBRL(piece.value)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-3 text-sm text-white/75">
              {flow.hasIncome ? `${closeLine} · entra ${formatBRL(flow.income)} · sai ${formatBRL(flow.expense)}` : closeLine}
            </p>
            {outflowPieces.length > 0 ? (
              <div className="mt-4 max-w-sm">
                <p className="text-xs font-semibold tracking-[0.16em] text-white/50 uppercase">O que sai no mês</p>
                <ul className="mt-2 space-y-1.5">
                  {outflowPieces.map((piece) => (
                    <li key={piece.label} className="flex items-baseline justify-between gap-6 text-sm text-white/80">
                      <span>{piece.label}</span>
                      <span className="font-medium tabular-nums text-white">{formatBRL(piece.value)}</span>
                    </li>
                  ))}
                </ul>
                {fixedOnCard > 0 ? (
                  <p className="mt-2 text-xs leading-relaxed text-white/50">
                    {formatBRL(fixedOnCard)} de fixo foi lançado no cartão e já está dentro dos cartões.
                  </p>
                ) : null}
              </div>
            ) : null}
            {state.incomes.length > 0 ? (
              <p className="mt-1 text-sm text-white/75">
                Sara {formatBRL(flow.people.sara)} · Vinicius {formatBRL(flow.people.vinicius)}
              </p>
            ) : null}
          </div>
          <button type="button" onClick={() => setIncomeOpen(true)} className="rounded-full bg-white/10 px-4 py-2 text-sm hover:bg-white/15">
            {state.incomes.length === 0 ? 'Informar renda' : 'Alterar renda'}
          </button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <HeroChip label="Gastos fixos" value={formatBRL(report.fixedTotal)} />
          <HeroChip label="Faturas do mês" value={formatBRL(report.invoiceTotal)} />
          <HeroChip label="À vista da casa" hint="Mercado, lazer e combustível fora do cartão" value={formatBRL(report.cashTotal)} />
          <HeroChip label="Líquido da empresa" hint="Entradas menos saídas" value={formatBRL(companyNet)} />
        </div>
      </section>

      <Panel title="Entradas e saídas" className="mt-4">
        <FlowChart items={series.map((item) => ({ key: item.month, label: item.label, income: item.income, expense: item.expense }))} />
        <p className="mt-4 text-xs leading-relaxed text-ink-soft">
          Entrada é a renda da Sara, do Vinicius e o que entrou na empresa. Saída é gasto fixo, gasto adicional, fatura, Pix e o que saiu da empresa.
        </p>
      </Panel>

      {late.length > 0 ? (
        <button type="button" onClick={() => setPage({ id: 'overdue' })} className="mt-4 flex w-full items-center justify-between gap-4 rounded-2xl bg-clay-soft px-5 py-4 text-left">
          <span>
            <span className="block text-sm font-medium text-clay">{late.length} vencida{late.length === 1 ? '' : 's'}</span>
            <span className="mt-1 block text-sm text-clay/80">Gestão do que já passou do dia e ainda está em aberto.</span>
          </span>
          <span className="font-serif text-2xl tabular-nums text-clay">{formatBRL(lateTotal)}</span>
        </button>
      ) : null}

      {leisureOver || groceryOver || fuelOver ? (
        <div className="mt-4 rounded-2xl border border-clay/40 bg-clay-soft px-5 py-4 text-sm leading-relaxed text-clay">
          {leisureOver ? <p>O lazer desta semana passou do teto em {formatBRL(leisure.total - (state.goals.leisureWeeklyMax ?? 0))}.</p> : null}
          {groceryOver ? <p>O mercado de {monthTitle(month).split(' de ')[0].toLowerCase()} passou da meta em {formatBRL(grocery.total - (goal.amount ?? 0))}.</p> : null}
          {fuelOver ? <p>O combustível de {monthTitle(month).split(' de ')[0].toLowerCase()} passou da meta em {formatBRL(fuelSpent.total - (fuel.amount ?? 0))}.</p> : null}
        </div>
      ) : null}

      {pending.length > 0 ? (
        <Panel title="Para a casa ficar visível" className="mt-4" action={<span className="text-sm text-ink-soft">{steps.length - pending.length} de {steps.length}</span>}>
          <div className="grid gap-2">
            {steps.map((step) => (
              <button
                key={step.label}
                type="button"
                onClick={step.action}
                className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 text-left hover:bg-paper"
              >
                <span>
                  <span className="block text-sm font-medium">{step.label}</span>
                  <span className="block text-xs text-ink-soft">{step.hint}</span>
                </span>
                <span className={`text-xs font-medium ${step.done ? 'text-moss' : 'text-amber'}`}>{step.done ? 'Pronto' : 'Fazer'}</span>
              </button>
            ))}
          </div>
        </Panel>
      ) : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel
          title="Lazer da semana"
          action={
            <Button variant="ghost" className="h-9 px-3" onClick={() => setPage({ id: 'leisure', compose: true })}>
              Lançar
            </Button>
          }
        >
          <p className="mb-3 text-sm text-ink-soft">{weekTitle(weekStart)}</p>
          <BudgetMeter spent={leisure.total} goal={state.goals.leisureWeeklyMax} />
          <button type="button" onClick={() => setPage({ id: 'goals' })} className="mt-4 text-sm font-medium text-moss">
            Ajustar teto semanal
          </button>
        </Panel>
        <Panel
          title="Mercado do mês"
          action={
            <Button variant="ghost" className="h-9 px-3" onClick={() => setPage({ id: 'grocery', compose: true })}>
              Lançar
            </Button>
          }
        >
          <p className="mb-3 text-sm text-ink-soft">
            {goal.inflowTotal > 0
              ? `Inclui ${formatBRL(goal.inflowTotal)} de entrada, como vale alimentação.`
              : goal.override
                ? 'Meta ajustada só para este mês.'
                : 'Usando a meta padrão.'}
          </p>
          <BudgetMeter spent={grocery.total} goal={goal.amount} />
          <button type="button" onClick={() => setPage({ id: 'grocery' })} className="mt-4 text-sm font-medium text-moss">
            Ajustar meta de {monthTitle(month).split(' de ')[0].toLowerCase()}
          </button>
        </Panel>
        <Panel
          title="Combustível do mês"
          action={
            <Button variant="ghost" className="h-9 px-3" onClick={() => setPage({ id: 'fuel', compose: true })}>
              Lançar
            </Button>
          }
        >
          <p className="mb-3 text-sm text-ink-soft">{fuel.override ? 'Meta ajustada só para este mês.' : 'Usando a meta padrão.'}</p>
          <BudgetMeter spent={fuelSpent.total} goal={fuel.amount} />
          <button type="button" onClick={() => setPage({ id: 'fuel' })} className="mt-4 text-sm font-medium text-moss">
            Ver abastecimentos
          </button>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Panel title="Vencimentos do mês">
          {dues.length === 0 ? (
            <p className="text-sm text-ink-soft">Nada com valor neste mês. Cadastre um gasto fixo ou uma compra no cartão.</p>
          ) : (
            <ul className="divide-y divide-line">
              {dues.map((item) => {
                const tone = dueTone(item.due, today, item.paid)
                return (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {item.icon ? <ExpenseMark name={item.icon} /> : null}
                      <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-ink-soft">
                        {formatShort(item.due)} · {item.detail}
                      </p>
                    </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <ToneBadge tone={tone}>{toneLabel(tone)}</ToneBadge>
                      <span className="font-medium tabular-nums">{formatBRL(item.amount)}</span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
        <Panel title="Cartões" action={<Button variant="ghost" className="h-9 px-3" onClick={() => setPage({ id: 'cards' })}>Ver</Button>}>
          {state.cards.length === 0 ? (
            <p className="text-sm leading-relaxed text-ink-soft">Nenhum cartão ainda. Quando cadastrar, a fatura que vence neste mês aparece aqui.</p>
          ) : (
            <ul className="space-y-3">
              {state.cards.map((card) => {
                const used = limitUsed(card, state, today)
                const dueInvoice = invoicesDueInMonth(state, month).find((invoice) => invoice.cardId === card.id)
                const open = openInvoiceMonth(today, card.closingDay)
                const openInvoice = invoiceForCard(card, state.purchases, open.year, open.monthIndex, state.paidInvoices, state.companyEntries)
                const ratio = card.limit > 0 ? Math.min(used / card.limit, 1) : 0
                return (
                  <li key={card.id}>
                    <button type="button" onClick={() => setPage({ id: 'card', cardId: card.id })} className="w-full rounded-xl px-2 py-2 text-left hover:bg-paper">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="font-medium">{card.nickname}</span>
                        <span className="text-sm tabular-nums">{formatBRL(openInvoice.total)}</span>
                      </span>
                      <span className="mt-1 block text-xs text-ink-soft">
                        Fatura aberta · vence {formatShort(openInvoice.due)}
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-soft">
                        Neste mês sai {formatBRL(dueInvoice?.total ?? 0)}
                        {card.limit > 0 ? ` · ${formatBRL(Math.max(0, round2(card.limit - used)))} livres` : ''}
                      </span>
                      {card.limit > 0 ? (
                        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-track">
                          <span className={`block h-full rounded-full ${used > card.limit ? 'bg-clay' : 'bg-moss'}`} style={{ width: `${ratio * 100}%` }} />
                        </span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Para onde foi o variável" className="mt-4">
        {slices.length === 0 ? (
          <p className="text-sm text-ink-soft">Nenhuma compra variável em {monthTitle(month).toLowerCase()}.</p>
        ) : (
          <ul className="space-y-3">
            {slices.map((slice) => (
              <li key={slice.id}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{slice.label}</span>
                  <span className="tabular-nums">{formatBRL(slice.amount)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-track">
                  <div className="h-full rounded-full bg-moss" style={{ width: `${(slice.amount / peak) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs leading-relaxed text-ink-soft">
          À vista entra no mês da compra. No parcelado, entra só a parcela daquele mês. A fatura do cartão segue o fechamento.
        </p>
      </Panel>

      {incomeOpen ? <IncomeDialog onClose={() => setIncomeOpen(false)} /> : null}
    </div>
  )
}

function HeroChip({ label, hint, value }: { label: string; hint?: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/10 px-4 py-3">
      <p className="text-xs text-white/60">{label}</p>
      {hint ? <p className="mt-1 text-[11px] leading-snug text-white/45">{hint}</p> : null}
      <p className="mt-1 font-serif text-2xl tabular-nums">{value}</p>
    </div>
  )
}
