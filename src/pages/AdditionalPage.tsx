import { useState } from 'react'
import { SettleDialog } from '../components/dialogs.tsx'
import { ConfirmDialog, Modal } from '../components/Modal.tsx'
import { Button, EmptyState, Field, MoneyField, PageIntro, ToneBadge, fieldClass, toneLabel } from '../components/ui.tsx'
import { dateOn, dueTone, formatShort, monthKey, monthTitle, parseDate, parseMonthKey, todayISO } from '../lib/dates.ts'
import { additionalApplies, additionalKey, additionalMonthAmount, additionalSurcharge } from '../lib/finance.ts'
import { formatBRL, formatInput, parseMoney, uid } from '../lib/money.ts'
import type { AdditionalExpense } from '../lib/types.ts'
import { useStore } from '../state.tsx'

export function AdditionalPage() {
  const { state, month, today, upsertAdditional, removeAdditional, setAdditionalPaid } = useStore()
  const [editing, setEditing] = useState<AdditionalExpense | null | 'new'>(null)
  const [removing, setRemoving] = useState<AdditionalExpense | null>(null)
  const [paying, setPaying] = useState<AdditionalExpense | null>(null)
  const { year, monthIndex } = parseMonthKey(month)
  const selected = year * 12 + monthIndex
  const expenses = state.additionalExpenses ?? []
  const current = expenses.filter((expense) => additionalApplies(expense, month)).sort(byDue)
  const later = expenses.filter((expense) => monthSerial(expense.startDate) > selected).sort(byDue)
  const finished = expenses.filter((expense) => monthSerial(expense.endDate) < selected).sort(byDue)
  const total = current.reduce((sum, expense) => sum + additionalMonthAmount(expense, state, month), 0)
  const paid = current.reduce((sum, expense) => sum + (state.paidAdditional?.[additionalKey(expense.id, month)] ? additionalMonthAmount(expense, state, month) : 0), 0)

  return (
    <div>
      <PageIntro
        eyebrow="Com data para acabar"
        title="Gastos adicionais"
        description="Um valor que se repete por alguns meses e depois acaba. Sai da conta, sem cartão, e não entra nos fixos."
        action={<Button onClick={() => setEditing('new')}>Novo gasto</Button>}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Summary label="Total do mês" value={formatBRL(total)} />
        <Summary label="Já pago" value={formatBRL(paid)} />
        <Summary label="Em aberto" value={formatBRL(total - paid)} />
      </div>

      {expenses.length === 0 ? (
        <EmptyState
          title="Nenhum gasto adicional"
          text="Cadastre o que tem começo e fim, como um curso, um acordo ou uma parcela fora do cartão."
          action={<Button onClick={() => setEditing('new')}>Cadastrar o primeiro</Button>}
        />
      ) : current.length > 0 ? (
        <ul className="overflow-hidden rounded-2xl border border-line bg-card">
          {current.map((expense) => {
            const due = dateOn(year, monthIndex, expense.dueDay)
            const isPaid = Boolean(state.paidAdditional?.[additionalKey(expense.id, month)])
            const tone = dueTone(due, today, isPaid)
            const last = monthKey(parseDate(expense.endDate)) === month
            return (
              <li key={expense.id} className="flex items-center gap-3 border-b border-line px-4 py-4 last:border-b-0 md:px-5">
                <label className="flex h-10 w-10 shrink-0 items-center justify-center">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-moss"
                    checked={isPaid}
                    aria-label={`Marcar ${expense.name} como pago`}
                    onChange={() => {
                      if (isPaid) setAdditionalPaid(expense.id, month, false)
                      else setPaying(expense)
                    }}
                  />
                </label>
                <button type="button" onClick={() => setEditing(expense)} className="min-w-0 flex-1 text-left">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className={`font-medium ${isPaid ? 'text-ink/50 line-through' : ''}`}>{expense.name}</span>
                    <ToneBadge tone={tone}>{toneLabel(tone)}</ToneBadge>
                  </span>
                  <span className="mt-1 block text-xs text-ink-soft">
                    Vence {formatShort(due)} · até {monthTitle(monthKey(parseDate(expense.endDate)))}
                    {last ? ' · último mês' : ''}
                    {additionalSurcharge(state, expense.id, month) > 0 ? ` · juros e multa ${formatBRL(additionalSurcharge(state, expense.id, month))}` : ''}
                    {expense.notes ? ` · ${expense.notes}` : ''}
                  </span>
                </button>
                <span className="font-medium tabular-nums">{formatBRL(additionalMonthAmount(expense, state, month))}</span>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="rounded-2xl border border-line bg-card px-5 py-4 text-sm text-ink-soft">Nenhum gasto adicional neste mês.</p>
      )}

      {later.length > 0 ? <Later title="Começam depois" items={later} onEdit={setEditing} /> : null}
      {finished.length > 0 ? <Later title="Já acabaram" items={finished} onEdit={setEditing} muted /> : null}

      {editing !== null ? (
        <AdditionalDialog
          expense={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={upsertAdditional}
          onRemove={(expense) => {
            setEditing(null)
            setRemoving(expense)
          }}
        />
      ) : null}
      {paying ? (
        <SettleDialog
          title={`Pagar ${paying.name}`}
          month={month}
          principal={paying.amount}
          confirmLabel="Saiu da conta"
          onClose={() => setPaying(null)}
          onConfirm={(surcharge) => setAdditionalPaid(paying.id, month, true, surcharge)}
        />
      ) : null}
      {removing ? (
        <ConfirmDialog
          title="Excluir gasto adicional"
          text={`Excluir ${removing.name}? Ele sai dos meses em que ainda aparecia.`}
          confirmLabel="Excluir"
          onClose={() => setRemoving(null)}
          onConfirm={() => {
            removeAdditional(removing.id)
            setRemoving(null)
          }}
        />
      ) : null}
    </div>
  )
}

function Later({ title, items, onEdit, muted = false }: { title: string; items: AdditionalExpense[]; onEdit: (expense: AdditionalExpense) => void; muted?: boolean }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-medium text-ink-soft">{title}</h2>
      <ul className="divide-y divide-line rounded-2xl border border-line bg-card">
        {items.map((expense) => (
          <li key={expense.id}>
            <button type="button" onClick={() => onEdit(expense)} className={`flex w-full items-center gap-3 px-5 py-3 text-left ${muted ? 'text-ink/60' : ''}`}>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{expense.name}</span>
                <span className="mt-1 block text-xs text-ink-soft">
                  {monthTitle(monthKey(parseDate(expense.startDate)))} até {monthTitle(monthKey(parseDate(expense.endDate)))}
                </span>
              </span>
              <span className="tabular-nums">{formatBRL(expense.amount)}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
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

function byDue(a: AdditionalExpense, b: AdditionalExpense) {
  return a.dueDay - b.dueDay || a.name.localeCompare(b.name, 'pt-BR')
}

function monthSerial(date: string) {
  const when = parseDate(date)
  return when.getFullYear() * 12 + when.getMonth()
}

function AdditionalDialog({
  expense,
  onClose,
  onSave,
  onRemove,
}: {
  expense: AdditionalExpense | null
  onClose: () => void
  onSave: (expense: AdditionalExpense) => void
  onRemove: (expense: AdditionalExpense) => void
}) {
  const [name, setName] = useState(expense?.name ?? '')
  const [amount, setAmount] = useState(expense ? formatInput(expense.amount) : '')
  const [dueDay, setDueDay] = useState(String(expense?.dueDay ?? new Date().getDate()))
  const [startDate, setStartDate] = useState(expense?.startDate ?? todayISO())
  const [endDate, setEndDate] = useState(expense?.endDate ?? '')
  const [notes, setNotes] = useState(expense?.notes ?? '')
  const [error, setError] = useState('')

  const save = () => {
    const value = parseMoney(amount)
    const day = Math.round(Number(dueDay))
    if (!name.trim() || value == null || value <= 0 || day < 1 || day > 31) {
      setError('Informe o nome, o valor e o dia do vencimento.')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      setError('Informe quando começa e quando acaba.')
      return
    }
    if (monthSerial(endDate) < monthSerial(startDate)) {
      setError('A data final precisa ser no mês inicial ou depois.')
      return
    }
    onSave({
      id: expense?.id ?? uid(),
      name: name.trim(),
      amount: value,
      dueDay: day,
      startDate,
      endDate,
      notes: notes.trim(),
    })
    onClose()
  }

  return (
    <Modal
      title={expense ? 'Editar gasto adicional' : 'Novo gasto adicional'}
      description="Entra todo mês, da data inicial até o mês final. Não vai para o cartão."
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          {expense ? (
            <Button variant="danger" onClick={() => onRemove(expense)}>
              Excluir
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={save}>Salvar</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 pb-2">
        <Field label="Nome">
          <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} autoFocus />
        </Field>
        <MoneyField label="Valor do mês" value={amount} onChange={setAmount} />
        <Field label="Dia do vencimento">
          <input className={fieldClass} inputMode="numeric" value={dueDay} onChange={(event) => setDueDay(event.target.value)} />
        </Field>
        <Field label="Começa em" hint="Antes desse mês, não entra na conta.">
          <input className={fieldClass} type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
        </Field>
        <Field label="Acaba em" hint="O último mês em que o valor ainda sai.">
          <input className={fieldClass} type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
        </Field>
        <Field label="Nota">
          <input className={fieldClass} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
        {error ? <p className="text-sm text-clay">{error}</p> : null}
      </div>
    </Modal>
  )
}
