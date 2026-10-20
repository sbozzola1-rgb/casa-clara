import { useState } from 'react'
import { CompanyDialog } from '../components/dialogs.tsx'
import { Button, EmptyState, FlowChart, PageIntro, Panel } from '../components/ui.tsx'
import { formatFriendly, monthTitle } from '../lib/dates.ts'
import { companyInMonth, flowSeries } from '../lib/finance.ts'
import { formatBRL, round2 } from '../lib/money.ts'
import type { CompanyEntry } from '../lib/types.ts'
import { useStore } from '../state.tsx'

export function CompanyPage() {
  const { state, month, today } = useStore()
  const [editing, setEditing] = useState<CompanyEntry | null | 'new'>(null)
  const company = companyInMonth(state, month)
  const balance = round2(company.entradas - company.saidas)
  const series = flowSeries(
    { ...state, incomes: [], fixedExpenses: [], purchases: [], cashExpenses: [], cards: [] },
    month,
  )

  return (
    <div>
      <PageIntro
        eyebrow="Fora da casa"
        title="Empresa"
        description="Entradas e saídas do negócio. As duas entram na conta da casa: entrada na renda, saída no que sai no mês."
        action={<Button onClick={() => setEditing('new')}>Novo movimento</Button>}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Summary label="Entradas" value={formatBRL(company.entradas)} tone="good" />
        <Summary label="Saídas" value={formatBRL(company.saidas)} tone="bad" />
        <Summary label="Saldo do mês" value={formatBRL(balance)} tone={balance < 0 ? 'bad' : 'good'} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel title={monthTitle(month)}>
          {company.entries.length === 0 ? (
            <EmptyState
              title="Nenhum movimento"
              text="Lance uma venda, um pró-labore, um fornecedor ou um imposto. O mês aberto em cima é o que entra na lista."
              action={<Button onClick={() => setEditing('new')}>Lançar</Button>}
            />
          ) : (
            <ul className="divide-y divide-line">
              {[...company.entries]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((entry) => (
                  <li key={entry.id}>
                    <button type="button" onClick={() => setEditing(entry)} className="flex w-full items-center justify-between gap-3 py-3 text-left">
                      <span>
                        <span className="block text-sm font-medium">{entry.description}</span>
                        <span className="block text-xs text-ink-soft">
                          {formatFriendly(entry.date, today)} · {entry.category} · {entry.direction === 'entrada' ? 'Entrada' : 'Saída'}
                        </span>
                      </span>
                      <span className={`font-medium tabular-nums ${entry.direction === 'entrada' ? 'text-moss' : 'text-clay'}`}>
                        {entry.direction === 'entrada' ? '' : '−'}
                        {formatBRL(entry.amount)}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </Panel>
        <Panel title="Entradas e saídas">
          <FlowChart items={series.map((item) => ({ key: item.month, label: item.label, income: item.income, expense: item.expense }))} />
          <p className="mt-3 text-xs leading-relaxed text-ink-soft">Só o movimento da empresa. No início, o gráfico junta isso com a renda da Sara, do Vinicius e com os gastos da casa.</p>
        </Panel>
      </div>

      {editing !== null ? <CompanyDialog entry={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
    </div>
  )
}

function Summary({ label, value, tone }: { label: string; value: string; tone: 'good' | 'bad' }) {
  return (
    <div className="rounded-2xl border border-line bg-card px-4 py-3">
      <p className="text-xs tracking-wide text-ink-soft uppercase">{label}</p>
      <p className={`mt-1 font-serif text-2xl tabular-nums ${tone === 'bad' ? 'text-clay' : 'text-moss'}`}>{value}</p>
    </div>
  )
}
