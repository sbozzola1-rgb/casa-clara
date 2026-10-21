import { useState } from 'react'
import { GroceryInflowDialog, MoneyDialog, SpendDialog } from '../components/dialogs.tsx'
import { BudgetMeter, Button, CompareBars, EmptyState, PageIntro, Panel } from '../components/ui.tsx'
import { addDays, formatFriendly, monthName, monthRange, monthTitle, startOfWeek, weekTitle } from '../lib/dates.ts'
import { fuelGoal, fuelSeries, groceryGoal, groceryInflowApplies, grocerySeries, leisureSeries, spentInRange } from '../lib/finance.ts'
import { formatBRL } from '../lib/money.ts'
import type { GroceryInflow, SpendEntry } from '../lib/types.ts'
import { useStore } from '../state.tsx'

export function GroceryPage() {
  const { state, month, today, page, setPage, setGroceryMonth } = useStore()
  const [dialog, setDialog] = useState<SpendEntry | null | 'new'>(() => (page.id === 'grocery' && page.compose ? 'new' : null))
  const [adjusting, setAdjusting] = useState(false)
  const [inflow, setInflow] = useState<GroceryInflow | null | 'new'>(null)
  const range = monthRange(month)
  const spent = spentInRange(state, 'mercado', range.start, range.end)
  const goal = groceryGoal(state, month)
  const series = grocerySeries(state, month)
  const inflows = state.groceryInflows.filter((item) => groceryInflowApplies(item, month))

  const close = () => {
    setDialog(null)
    setPage({ id: 'grocery' })
  }

  return (
    <div>
      <PageIntro
        eyebrow="Meta mensal"
        title="Mercado"
        description="As compras entram pelo valor cheio, no mês em que aconteceram. Vale alimentação e outras entradas aumentam a meta desse mês."
        action={<Button onClick={() => setDialog('new')}>Lançar compra</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel title={monthTitle(month)}>
          <BudgetMeter spent={spent.total} goal={goal.amount} />
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setInflow('new')}>
              Fonte de entrada
            </Button>
            <Button variant="secondary" onClick={() => setAdjusting(true)}>
              Ajustar meta de {monthName(month)}
            </Button>
            {goal.override ? (
              <Button variant="ghost" onClick={() => setGroceryMonth(month, null)}>
                Voltar à meta padrão
              </Button>
            ) : null}
          </div>
          <p className="mt-4 text-sm leading-relaxed text-ink-soft">
            {goalText(goal, state.goals.groceryMonthlyDefault)}
          </p>
          {inflows.length > 0 ? (
            <ul className="mt-4 divide-y divide-line border-t border-line">
              {inflows.map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => setInflow(item)} className="flex w-full items-center justify-between gap-3 py-3 text-left">
                    <span>
                      <span className="block text-sm font-medium">{item.name}</span>
                      <span className="block text-xs text-ink-soft">{item.repeat === 'monthly' ? 'Todo mês' : 'Só neste mês'}</span>
                    </span>
                    <span className="text-sm font-medium tabular-nums">{formatBRL(item.amount)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>
        <Panel title="Últimos meses">
          <CompareBars items={series.map((item) => ({ key: item.month, label: item.label, spent: item.spent, goal: item.goal }))} />
        </Panel>
      </div>

      <section className="mt-4">
        <EntryList
          entries={spent.entries}
          today={today}
          empty="Nenhuma compra de mercado neste mês."
          onEdit={setDialog}
        />
      </section>

      {dialog !== null ? <SpendDialog category="mercado" entry={dialog === 'new' ? null : dialog} onClose={close} /> : null}
      {inflow !== null ? (
        <GroceryInflowDialog month={month} entry={inflow === 'new' ? null : inflow} onClose={() => setInflow(null)} />
      ) : null}
      {adjusting ? (
        <MoneyDialog
          title={`Meta de ${monthName(month)}`}
          description="Vale só para este mês. Os outros meses continuam na meta padrão, a menos que você ajuste cada um."
          label="Meta deste mês"
          initial={goal.amount}
          onClose={() => setAdjusting(false)}
          onSave={(value) => setGroceryMonth(month, value)}
        />
      ) : null}
    </div>
  )
}

export function FuelPage() {
  const { state, month, today, page, setPage, setFuelMonth } = useStore()
  const [dialog, setDialog] = useState<SpendEntry | null | 'new'>(() => (page.id === 'fuel' && page.compose ? 'new' : null))
  const [adjusting, setAdjusting] = useState(false)
  const range = monthRange(month)
  const spent = spentInRange(state, 'combustivel', range.start, range.end)
  const goal = fuelGoal(state, month)
  const series = fuelSeries(state, month)

  const close = () => {
    setDialog(null)
    setPage({ id: 'fuel' })
  }

  return (
    <div>
      <PageIntro
        eyebrow="Meta mensal"
        title="Combustível"
        description="Cada abastecimento entra pelo valor cheio, no mês da data. A meta pode ser a padrão ou só deste mês."
        action={<Button onClick={() => setDialog('new')}>Lançar abastecimento</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel title={monthTitle(month)}>
          <BudgetMeter spent={spent.total} goal={goal.amount} />
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setAdjusting(true)}>
              Ajustar meta de {monthName(month)}
            </Button>
            {goal.override ? (
              <Button variant="ghost" onClick={() => setFuelMonth(month, null)}>
                Voltar à meta padrão
              </Button>
            ) : null}
          </div>
          <p className="mt-4 text-sm leading-relaxed text-ink-soft">
            {goal.override
              ? `Este mês está em ${formatBRL(goal.amount ?? 0)}. A meta padrão continua ${state.goals.fuelMonthlyDefault == null ? 'sem valor' : formatBRL(state.goals.fuelMonthlyDefault)}.`
              : 'Este mês usa a meta padrão. Um ajuste vale só para o mês que está aberto em cima.'}
          </p>
        </Panel>
        <Panel title="Últimos meses">
          <CompareBars items={series.map((item) => ({ key: item.month, label: item.label, spent: item.spent, goal: item.goal }))} />
        </Panel>
      </div>

      <section className="mt-4">
        <EntryList entries={spent.entries} today={today} empty="Nenhum abastecimento neste mês." onEdit={setDialog} />
      </section>

      {dialog !== null ? <SpendDialog category="combustivel" entry={dialog === 'new' ? null : dialog} onClose={close} /> : null}
      {adjusting ? (
        <MoneyDialog
          title={`Meta de ${monthName(month)}`}
          description="Vale só para o combustível deste mês. Os outros meses continuam na meta padrão."
          label="Meta deste mês"
          initial={goal.amount}
          onClose={() => setAdjusting(false)}
          onSave={(value) => setFuelMonth(month, value)}
        />
      ) : null}
    </div>
  )
}

export function LeisurePage() {
  const { state, today, page, setPage } = useStore()
  const [dialog, setDialog] = useState<SpendEntry | null | 'new'>(() => (page.id === 'leisure' && page.compose ? 'new' : null))
  const [weekOffset, setWeekOffset] = useState(0)
  const start = addDays(startOfWeek(today), weekOffset * 7)
  const end = addDays(start, 6)
  const spent = spentInRange(state, 'lazer', start, end)
  const series = leisureSeries(state, start)

  const close = () => {
    setDialog(null)
    setPage({ id: 'leisure' })
  }

  return (
    <div>
      <PageIntro
        eyebrow="Teto semanal"
        title="Lazer"
        description="O teto é o máximo da semana, não uma média. Cinema, delivery, saída e qualquer compra marcada como lazer entram na semana da data."
        action={<Button onClick={() => setDialog('new')}>Lançar gasto</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel
          title="Semana"
          action={
            weekOffset !== 0 ? (
              <Button variant="ghost" className="h-9 px-3" onClick={() => setWeekOffset(0)}>
                Esta semana
              </Button>
            ) : null
          }
        >
          <div className="mb-4 flex items-center gap-2">
            <button type="button" aria-label="Semana anterior" onClick={() => setWeekOffset((value) => value - 1)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-paper">
              <Chevron />
            </button>
            <p className="min-w-40 text-center text-sm font-medium">{weekTitle(start)}</p>
            <button type="button" aria-label="Próxima semana" onClick={() => setWeekOffset((value) => value + 1)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-paper">
              <Chevron direction="right" />
            </button>
          </div>
          <BudgetMeter spent={spent.total} goal={state.goals.leisureWeeklyMax} />
          <button type="button" onClick={() => setPage({ id: 'goals' })} className="mt-4 text-sm font-medium text-moss">
            Ajustar o teto semanal
          </button>
          <p className="mt-3 text-xs text-ink-soft">Semana de {formatFriendlyDate(start)} até {formatFriendlyDate(end)}, de segunda a domingo.</p>
        </Panel>
        <Panel title="Semanas recentes">
          <CompareBars items={series.map((item) => ({ key: item.start.toISOString(), label: item.label, spent: item.spent, goal: item.cap }))} />
          <p className="mt-2 text-xs text-ink-soft">As semanas antigas são comparadas com o teto de agora.</p>
        </Panel>
      </div>

      <section className="mt-4">
        <EntryList entries={spent.entries} today={today} empty="Nenhum gasto de lazer nesta semana." onEdit={setDialog} />
      </section>

      {dialog !== null ? <SpendDialog category="lazer" entry={dialog === 'new' ? null : dialog} onClose={close} /> : null}
    </div>
  )
}

function EntryList({
  entries,
  today,
  empty,
  onEdit,
}: {
  entries: SpendEntry[]
  today: Date
  empty: string
  onEdit: (entry: SpendEntry) => void
}) {
  if (entries.length === 0) {
    return <EmptyState title="Nada lançado" text={empty} />
  }
  return (
    <ul className="overflow-hidden rounded-2xl border border-line bg-card">
      {entries.map((entry) => (
        <li key={`${entry.source}-${entry.id}`} className="border-b border-line last:border-b-0">
          <button type="button" onClick={() => onEdit(entry)} className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left">
            <span>
              <span className="block font-medium">{entry.description}</span>
              <span className="block text-xs text-ink-soft">
                {formatFriendly(entry.date, today)} · {entry.detail}
              </span>
            </span>
            <span className="font-medium tabular-nums">{formatBRL(entry.amount)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function goalText(
  goal: { amount: number | null; override: boolean; base: number | null; inflowTotal: number },
  fallback: number | null,
): string {
  if (goal.inflowTotal > 0 && goal.base != null) {
    return `A meta da casa é ${formatBRL(goal.base)}. As entradas somam ${formatBRL(goal.inflowTotal)}, então o mês fica em ${formatBRL(goal.amount ?? 0)}.`
  }
  if (goal.inflowTotal > 0) {
    return `Este mês a meta é a entrada de ${formatBRL(goal.inflowTotal)}.`
  }
  if (goal.override) {
    return `Este mês está em ${formatBRL(goal.amount ?? 0)}. A meta padrão continua ${fallback == null ? 'sem valor' : formatBRL(fallback)}.`
  }
  return 'Este mês usa a meta padrão. Um ajuste vale só para o mês que está aberto em cima.'
}

function formatFriendlyDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })
}

function Chevron({ direction = 'left' }: { direction?: 'left' | 'right' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className={direction === 'right' ? 'rotate-180' : ''}>
      <path d="M10 3.5 5.5 8 10 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
