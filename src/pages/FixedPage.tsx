import { useState } from 'react'
import { FixedDialog, PayFixedDialog } from '../components/dialogs.tsx'
import { ExpenseMark } from '../components/ExpenseIcon.tsx'
import { Button, EmptyState, PageIntro, ToneBadge, toneLabel } from '../components/ui.tsx'
import { dateOn, dueTone, formatShort, parseDate, parseMonthKey } from '../lib/dates.ts'
import { fixedApplies, fixedCardPurchaseId, fixedKey, fixedMonthAmount, fixedSurcharge, monthReport } from '../lib/finance.ts'
import { formatBRL } from '../lib/money.ts'
import type { FixedExpense } from '../lib/types.ts'
import { useStore } from '../state.tsx'

export function FixedPage() {
  const { state, month, today, unpayFixed } = useStore()
  const [editing, setEditing] = useState<FixedExpense | null | 'new'>(null)
  const [paying, setPaying] = useState<FixedExpense | null>(null)
  const { year, monthIndex } = parseMonthKey(month)
  const report = monthReport(state, month)
  const active = [...state.fixedExpenses.filter((expense) => fixedApplies(expense, month))].sort((a, b) => a.dueDay - b.dueDay || a.name.localeCompare(b.name))
  const upcoming = state.fixedExpenses.filter((expense) => expense.active && !fixedApplies(expense, month))
  const inactive = state.fixedExpenses.filter((expense) => !expense.active)

  return (
    <div>
      <PageIntro
        eyebrow="Todo mês"
        title="Gastos fixos"
        description="O que se repete independente do mercado e do lazer. Marque como pago quando sair da conta ou for para um cartão."
        action={<Button onClick={() => setEditing('new')}>Novo gasto</Button>}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Summary label="Total do mês" value={formatBRL(report.fixedTotal)} />
        <Summary label="Já pago" value={formatBRL(report.fixedPaid)} />
        <Summary label="Em aberto" value={formatBRL(report.fixedOpen)} />
      </div>

      {active.length === 0 && upcoming.length === 0 ? (
        <EmptyState
          title="Nenhum gasto fixo"
          text="Comece pelo que não dá para esquecer: aluguel, condomínio, luz, água, internet, escola."
          action={<Button onClick={() => setEditing('new')}>Cadastrar o primeiro</Button>}
        />
      ) : active.length > 0 ? (
        <ul className="overflow-hidden rounded-2xl border border-line bg-card">
          {active.map((expense) => {
            const due = dateOn(year, monthIndex, expense.dueDay)
            const paid = Boolean(state.paidFixed[fixedKey(expense.id, month)])
            const cardPaid = state.purchases.find((item) => item.id === fixedCardPurchaseId(expense.id, month))
            const cardName = state.cards.find((item) => item.id === cardPaid?.cardId)?.nickname
            const tone = dueTone(due, today, paid)
            return (
              <li key={expense.id} className="flex items-center gap-3 border-b border-line px-4 py-4 last:border-b-0 md:px-5">
                <label className="flex h-10 w-10 shrink-0 items-center justify-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={paid}
                    aria-label={`Marcar ${expense.name} como pago`}
                    onChange={() => {
                      if (paid) unpayFixed(expense.id, month)
                      else setPaying(expense)
                    }}
                  />
                </label>
                <ExpenseMark name={expense.icon} />
                <button type="button" onClick={() => setEditing(expense)} className="min-w-0 flex-1 text-left">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={`font-medium ${paid ? 'text-ink/50 line-through' : ''}`}>{expense.name}</span>
                    <ToneBadge tone={tone}>{toneLabel(tone)}</ToneBadge>
                  </span>
                  <span className="mt-1 block text-xs text-ink-soft">
                    Vence {formatShort(due)} · {expense.category}
                    {expense.startDate ? ` · desde ${formatShort(parseDate(expense.startDate))}` : ''}
                    {cardName ? ` · no ${cardName}` : ''}
                    {fixedSurcharge(state, expense.id, month) > 0 ? ` · juros e multa ${formatBRL(fixedSurcharge(state, expense.id, month))}` : ''}
                    {expense.notes ? ` · ${expense.notes}` : ''}
                  </span>
                </button>
                <span className="font-medium tabular-nums">{formatBRL(fixedMonthAmount(expense, state, month))}</span>
              </li>
            )
          })}
        </ul>
      ) : null}

      {upcoming.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium text-ink-soft">Começam depois</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
            {upcoming.map((expense) => (
              <li key={expense.id}>
                <button type="button" onClick={() => setEditing(expense)} className="flex w-full items-center gap-3 px-5 py-3 text-left">
                  <ExpenseMark name={expense.icon} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{expense.name}</span>
                    <span className="mt-1 block text-xs text-ink-soft">
                      Desde {expense.startDate ? formatShort(parseDate(expense.startDate)) : 'o início'} · {expense.category}
                    </span>
                  </span>
                  <span className="tabular-nums">{formatBRL(expense.amount)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {inactive.length > 0 ? (
        <section className="mt-8">
          <h2 className="mb-3 text-sm font-medium text-ink-soft">Fora da conta do mês</h2>
          <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
            {inactive.map((expense) => (
              <li key={expense.id}>
                <button type="button" onClick={() => setEditing(expense)} className="flex w-full items-center gap-3 px-5 py-3 text-left text-ink/60">
                  <ExpenseMark name={expense.icon} />
                  <span className="flex-1">{expense.name}</span>
                  <span className="tabular-nums">{formatBRL(expense.amount)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {editing !== null ? (
        <FixedDialog expense={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      ) : null}
      {paying ? <PayFixedDialog expense={paying} month={month} onClose={() => setPaying(null)} /> : null}
    </div>
  )
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-card px-4 py-3">
      <p className="text-xs tracking-wide text-ink-soft uppercase">{label}</p>
      <p className="mt-1 font-serif text-2xl tabular-nums">{value}</p>
    </div>
  )
}
