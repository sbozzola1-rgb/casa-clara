import { useState } from 'react'
import { PayFixedDialog } from '../components/dialogs.tsx'
import { ExpenseMark } from '../components/ExpenseIcon.tsx'
import { EmptyState, PageIntro, Panel } from '../components/ui.tsx'
import { formatShort, monthKey, monthTitle } from '../lib/dates.ts'
import { overdueItems, type OverdueItem } from '../lib/finance.ts'
import { formatBRL, round2 } from '../lib/money.ts'
import type { FixedExpense } from '../lib/types.ts'
import { useStore } from '../state.tsx'

export function OverduePage() {
  const { state, today, setAdditionalPaid, toggleInvoicePaid } = useStore()
  const [paying, setPaying] = useState<{ expense: FixedExpense; month: string } | null>(null)
  const items = overdueItems(state, today)
  const total = round2(items.reduce((sum, item) => sum + item.amount, 0))
  const groups = groupByMonth(items)

  const markPaid = (item: OverdueItem) => {
    if (item.kind === 'fixed' && item.expenseId) {
      const expense = state.fixedExpenses.find((entry) => entry.id === item.expenseId)
      if (!expense) return
      setPaying({ expense, month: item.month })
    }
    if (item.kind === 'additional' && item.expenseId) setAdditionalPaid(item.expenseId, item.month, true)
    if (item.kind === 'invoice' && item.cardId != null && item.year != null && item.monthIndex != null) {
      toggleInvoicePaid(item.cardId, item.year, item.monthIndex)
    }
  }

  return (
    <div>
      <PageIntro
        eyebrow="Em atraso"
        title="Vencidas"
        description="Contas da casa com vencimento já passado, nos últimos 6 meses. Marque como paga quando o dinheiro sair."
      />

      <section className={`rounded-3xl px-6 py-6 text-white md:px-8 ${items.length > 0 ? 'bg-clay' : 'bg-moss'}`}>
        <p className="text-xs font-semibold tracking-[0.16em] text-white/70 uppercase">Total vencido</p>
        <p className="mt-2 font-serif text-5xl tracking-tight tabular-nums">{formatBRL(total)}</p>
        <p className="mt-3 text-sm text-white/80">
          {items.length === 0 ? 'Nada em atraso. A casa está em dia neste período.' : `${items.length} conta${items.length === 1 ? '' : 's'} para resolver.`}
        </p>
      </section>

      {items.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="Nada vencido" text="Quando um gasto fixo ou uma fatura passar do dia e continuar em aberto, aparece aqui." />
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {groups.map((group) => (
            <Panel key={group.month} title={monthTitle(group.month)} action={<span className="text-sm tabular-nums text-ink-soft">{formatBRL(group.total)}</span>}>
              <ul className="divide-y divide-line">
                {group.items.map((item) => (
                  <li key={item.key} className="flex items-center gap-3 py-3">
                    <label className="flex h-10 w-10 shrink-0 items-center justify-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-moss"
                        checked={false}
                        aria-label={`Marcar ${item.title} de ${monthTitle(item.month)} como pago`}
                        onChange={() => markPaid(item)}
                      />
                    </label>
                    {item.icon ? <ExpenseMark name={item.icon} /> : null}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-ink-soft">
                        Venceu {formatShort(item.due)} · {item.detail}
                      </p>
                    </div>
                    <span className="font-medium tabular-nums text-clay">{formatBRL(item.amount)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
          <p className="text-xs leading-relaxed text-ink-soft">
            Se uma conta antiga já tinha sido paga antes de usar o app, marque ela aqui para sair da lista.
          </p>
        </div>
      )}
      {paying ? <PayFixedDialog expense={paying.expense} month={paying.month} onClose={() => setPaying(null)} /> : null}
    </div>
  )
}

function groupByMonth(items: OverdueItem[]) {
  const groups = new Map<string, OverdueItem[]>()
  for (const item of items) {
    const key = monthKey(item.due)
    const current = groups.get(key) ?? []
    current.push(item)
    groups.set(key, current)
  }
  return [...groups.entries()].map(([month, groupItems]) => ({
    month,
    items: groupItems,
    total: round2(groupItems.reduce((sum, item) => sum + item.amount, 0)),
  }))
}
