import { useState } from 'react'
import { FixedDialog } from '../components/dialogs.tsx'
import { ExpenseMark } from '../components/ExpenseIcon.tsx'
import { Button, EmptyState, PageIntro, ToneBadge, toneLabel } from '../components/ui.tsx'
import { dateOn, dueTone, formatShort, parseMonthKey } from '../lib/dates.ts'
import { fixedKey, monthReport } from '../lib/finance.ts'
import { formatBRL } from '../lib/money.ts'
import type { FixedExpense } from '../lib/types.ts'
import { useStore } from '../state.tsx'

export function FixedPage() {
  const { state, month, today, toggleFixedPaid } = useStore()
  const [editing, setEditing] = useState<FixedExpense | null | 'new'>(null)
  const { year, monthIndex } = parseMonthKey(month)
  const report = monthReport(state, month)
  const active = [...state.fixedExpenses.filter((expense) => expense.active)].sort((a, b) => a.dueDay - b.dueDay || a.name.localeCompare(b.name))
  const inactive = state.fixedExpenses.filter((expense) => !expense.active)

  return (
    <div>
      <PageIntro
        eyebrow="Todo mês"
        title="Gastos fixos"
        description="O que se repete independente do mercado e do lazer. Marque como pago quando o dinheiro sair da conta."
        action={<Button onClick={() => setEditing('new')}>Novo gasto</Button>}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Summary label="Total do mês" value={formatBRL(report.fixedTotal)} />
        <Summary label="Já pago" value={formatBRL(report.fixedPaid)} />
        <Summary label="Em aberto" value={formatBRL(report.fixedOpen)} />
      </div>

      {active.length === 0 ? (
        <EmptyState
          title="Nenhum gasto fixo"
          text="Comece pelo que não dá para esquecer: aluguel, condomínio, luz, água, internet, escola."
          action={<Button onClick={() => setEditing('new')}>Cadastrar o primeiro</Button>}
        />
      ) : (
        <ul className="overflow-hidden rounded-2xl border border-line bg-card">
          {active.map((expense) => {
            const due = dateOn(year, monthIndex, expense.dueDay)
            const paid = Boolean(state.paidFixed[fixedKey(expense.id, month)])
            const tone = dueTone(due, today, paid)
            return (
              <li key={expense.id} className="flex items-center gap-3 border-b border-line px-4 py-4 last:border-b-0 md:px-5">
                <label className="flex h-10 w-10 shrink-0 items-center justify-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={paid}
                    aria-label={`Marcar ${expense.name} como pago`}
                    onChange={() => toggleFixedPaid(expense.id, month)}
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
                    {expense.notes ? ` · ${expense.notes}` : ''}
                  </span>
                </button>
                <span className="font-medium tabular-nums">{formatBRL(expense.amount)}</span>
              </li>
            )
          })}
        </ul>
      )}

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
