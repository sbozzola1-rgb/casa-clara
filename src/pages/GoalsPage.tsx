import { useRef, useState } from 'react'
import { MoneyDialog } from '../components/dialogs.tsx'
import { Button, PageIntro, Panel } from '../components/ui.tsx'
import { monthName, monthTitle } from '../lib/dates.ts'
import { fuelGoal, groceryGoal } from '../lib/finance.ts'
import { formatISO } from '../lib/dates.ts'
import { formatBRL } from '../lib/money.ts'
import { useStore } from '../state.tsx'

export function GoalsPage() {
  const { state, month, setLeisureWeekly, setGroceryDefault, setGroceryMonth, setFuelDefault, setFuelMonth, replaceState, notify } = useStore()
  const goal = groceryGoal(state, month)
  const fuel = fuelGoal(state, month)
  const [which, setWhich] = useState<'leisure' | 'default' | 'month' | 'fuel-default' | 'fuel-month' | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const download = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `casa-clara-${formatISO(new Date())}.json`
    link.click()
    URL.revokeObjectURL(url)
    notify('Cópia baixada')
  }

  const restore = async (file: File | undefined) => {
    if (!file) return
    try {
      replaceState(JSON.parse(await file.text()))
    } catch {
      notify('Não foi possível ler o arquivo')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div>
      <PageIntro
        eyebrow="Limites da casa"
        title="Metas"
        description="O lazer tem um teto por semana. Mercado e combustível têm meta por mês, e esse mês pode ser diferente dos outros."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Lazer">
          <p className="text-sm text-ink-soft">Teto de cada semana, de segunda a domingo.</p>
          <p className="mt-3 font-serif text-5xl tracking-tight tabular-nums">
            {state.goals.leisureWeeklyMax == null ? '—' : formatBRL(state.goals.leisureWeeklyMax)}
          </p>
          <Button className="mt-5" onClick={() => setWhich('leisure')}>
            Definir teto semanal
          </Button>
          <p className="mt-4 text-sm leading-relaxed text-ink-soft">
            Quando uma compra de lazer passa desse valor na semana, a barra fica vermelha. O objetivo é parar antes, não depois.
          </p>
        </Panel>
        <Panel title="Mercado">
          <p className="text-sm text-ink-soft">Meta padrão, usada nos meses sem ajuste.</p>
          <p className="mt-3 font-serif text-5xl tracking-tight tabular-nums">
            {state.goals.groceryMonthlyDefault == null ? '—' : formatBRL(state.goals.groceryMonthlyDefault)}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => setWhich('default')}>Definir meta padrão</Button>
            <Button variant="secondary" onClick={() => setWhich('month')}>
              Ajustar {monthName(month)}
            </Button>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-ink-soft">
            {monthTitle(month)} está em{' '}
            {goal.amount == null ? 'aberto, sem meta' : formatBRL(goal.amount)}
            {goal.override ? ' — ajuste só deste mês.' : ' — meta padrão.'}
          </p>
          {goal.override ? (
            <button type="button" onClick={() => setGroceryMonth(month, null)} className="mt-3 text-sm font-medium text-moss">
              Voltar {monthName(month)} para a meta padrão
            </button>
          ) : null}
        </Panel>
        <Panel title="Combustível">
          <p className="text-sm text-ink-soft">Meta padrão do mês, usada quando não houver ajuste.</p>
          <p className="mt-3 font-serif text-5xl tracking-tight tabular-nums">
            {state.goals.fuelMonthlyDefault == null ? '—' : formatBRL(state.goals.fuelMonthlyDefault)}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button onClick={() => setWhich('fuel-default')}>Definir meta padrão</Button>
            <Button variant="secondary" onClick={() => setWhich('fuel-month')}>
              Ajustar {monthName(month)}
            </Button>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-ink-soft">
            {monthTitle(month)} está em {fuel.amount == null ? 'aberto, sem meta' : formatBRL(fuel.amount)}
            {fuel.override ? ' — ajuste só deste mês.' : ' — meta padrão.'}
          </p>
          {fuel.override ? (
            <button type="button" onClick={() => setFuelMonth(month, null)} className="mt-3 text-sm font-medium text-moss">
              Voltar {monthName(month)} para a meta padrão
            </button>
          ) : null}
        </Panel>
      </div>

      <Panel title="Cópia dos dados" className="mt-4">
        <p className="max-w-2xl text-sm leading-relaxed text-ink-soft">
          O que você lançar aparece para o Vinicius, e o que ele lançar aparece para você. A cópia em arquivo é só uma reserva.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={download}>Baixar cópia</Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            Restaurar cópia
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(event) => void restore(event.target.files?.[0])}
          />
        </div>
      </Panel>

      {which === 'leisure' ? (
        <MoneyDialog
          title="Teto semanal de lazer"
          description="É o máximo da semana inteira, somando cartão, Pix, débito e dinheiro."
          label="Teto da semana"
          initial={state.goals.leisureWeeklyMax}
          onClose={() => setWhich(null)}
          onSave={setLeisureWeekly}
        />
      ) : null}
      {which === 'default' ? (
        <MoneyDialog
          title="Meta padrão de mercado"
          description="Vale para todo mês que você não ajustar à parte."
          label="Meta mensal"
          initial={state.goals.groceryMonthlyDefault}
          onClose={() => setWhich(null)}
          onSave={setGroceryDefault}
        />
      ) : null}
      {which === 'fuel-default' ? (
        <MoneyDialog
          title="Meta padrão de combustível"
          description="Vale para todo mês que você não ajustar à parte."
          label="Meta mensal"
          initial={state.goals.fuelMonthlyDefault}
          onClose={() => setWhich(null)}
          onSave={setFuelDefault}
        />
      ) : null}
      {which === 'fuel-month' ? (
        <MoneyDialog
          title={`Combustível de ${monthName(month)}`}
          description="Só este mês muda. A meta padrão fica onde está."
          label="Meta deste mês"
          initial={fuel.amount}
          onClose={() => setWhich(null)}
          onSave={(value) => setFuelMonth(month, value)}
        />
      ) : null}
      {which === 'month' ? (
        <MoneyDialog
          title={`Meta de ${monthName(month)}`}
          description="Só este mês muda. A meta padrão fica onde está."
          label="Meta deste mês"
          initial={goal.amount}
          onClose={() => setWhich(null)}
          onSave={(value) => setGroceryMonth(month, value)}
        />
      ) : null}
    </div>
  )
}
