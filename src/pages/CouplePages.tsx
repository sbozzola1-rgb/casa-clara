import { useState } from 'react'
import { ConfirmDialog, Modal } from '../components/Modal.tsx'
import { Button, EmptyState, Field, MoneyField, PageIntro, Panel, fieldClass } from '../components/ui.tsx'
import { formatFriendly, todayISO } from '../lib/dates.ts'
import { formatBRL, formatInput, parseMoney, round2, uid } from '../lib/money.ts'
import type { LeisurePlan, SavingPot } from '../lib/types.ts'
import { useStore } from '../state.tsx'

export function SavingsPage() {
  const { state, upsertSaving, removeSaving } = useStore()
  const [editing, setEditing] = useState<SavingPot | null | 'new'>(null)
  const [removing, setRemoving] = useState<SavingPot | null>(null)
  const pots = [...state.savings].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  const saved = round2(pots.reduce((sum, pot) => sum + pot.saved, 0))
  const target = round2(pots.reduce((sum, pot) => sum + pot.target, 0))

  return (
    <div>
      <PageIntro
        eyebrow="Dinheiro guardado"
        title="Economias"
        description="Cada economia é um cofrinho: a meta e quanto já está separado. Esse valor não entra de novo nos gastos da casa."
        action={<Button onClick={() => setEditing('new')}>Nova economia</Button>}
      />

      {pots.length === 0 ? (
        <EmptyState title="Nenhuma economia" text="Crie um cofrinho para viagem, reserva ou o que vocês quiserem guardar." />
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <Summary label="Guardado" value={formatBRL(saved)} />
            <Summary label="Meta" value={formatBRL(target)} />
          </div>
          <ul className="grid gap-3">
            {pots.map((pot) => {
              const ratio = pot.target > 0 ? Math.min(1, pot.saved / pot.target) : 0
              return (
                <li key={pot.id}>
                  <button type="button" onClick={() => setEditing(pot)} className="w-full rounded-2xl border border-line bg-card p-5 text-left">
                    <span className="flex items-start justify-between gap-3">
                      <span className="font-medium">{pot.name}</span>
                      <span className="tabular-nums">
                        {formatBRL(pot.saved)}
                        <span className="text-ink-soft"> / {formatBRL(pot.target)}</span>
                      </span>
                    </span>
                    <span className="mt-3 block h-2 overflow-hidden rounded-full bg-paper">
                      <span className="block h-full rounded-full bg-moss" style={{ width: `${Math.round(ratio * 100)}%` }} />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {editing !== null ? (
        <SavingDialog
          pot={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={upsertSaving}
          onRemove={(pot) => {
            setEditing(null)
            setRemoving(pot)
          }}
        />
      ) : null}
      {removing ? (
        <ConfirmDialog
          title="Excluir economia"
          text={`Excluir ${removing.name}? O dinheiro guardado deixa de aparecer aqui.`}
          confirmLabel="Excluir"
          onClose={() => setRemoving(null)}
          onConfirm={() => {
            removeSaving(removing.id)
            setRemoving(null)
          }}
        />
      ) : null}
    </div>
  )
}

export function PlansPage() {
  const { state, today, upsertPlan, removePlan } = useStore()
  const [editing, setEditing] = useState<LeisurePlan | null | 'new'>(null)
  const [removing, setRemoving] = useState<LeisurePlan | null>(null)
  const plans = [...state.leisurePlans].sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name, 'pt-BR'))

  return (
    <div>
      <PageIntro
        eyebrow="Lazer combinado"
        title="Planos"
        description="Cadastre o lazer que vocês querem fazer: cinema, viagem, jantar. O gasto de verdade continua na aba Lazer, quando acontecer."
        action={<Button onClick={() => setEditing('new')}>Novo plano</Button>}
      />

      {plans.length === 0 ? (
        <EmptyState title="Nenhum plano" text="Registre um lazer com data e valor previsto." />
      ) : (
        <Panel title="Planos de lazer">
          <ul className="divide-y divide-line">
            {plans.map((plan) => (
              <li key={plan.id}>
                <button type="button" onClick={() => setEditing(plan)} className="flex w-full items-center justify-between gap-3 py-3 text-left">
                  <span>
                    <span className="block font-medium">{plan.name}</span>
                    <span className="block text-xs text-ink-soft">
                      {formatFriendly(plan.date, today)}
                      {plan.note ? ` · ${plan.note}` : ''}
                    </span>
                  </span>
                  <span className="tabular-nums">{formatBRL(plan.amount)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {editing !== null ? (
        <PlanDialog
          plan={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={upsertPlan}
          onRemove={(plan) => {
            setEditing(null)
            setRemoving(plan)
          }}
        />
      ) : null}
      {removing ? (
        <ConfirmDialog
          title="Excluir plano"
          text={`Excluir ${removing.name}?`}
          confirmLabel="Excluir"
          onClose={() => setRemoving(null)}
          onConfirm={() => {
            removePlan(removing.id)
            setRemoving(null)
          }}
        />
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

function SavingDialog({
  pot,
  onClose,
  onSave,
  onRemove,
}: {
  pot: SavingPot | null
  onClose: () => void
  onSave: (pot: SavingPot) => void
  onRemove: (pot: SavingPot) => void
}) {
  const [name, setName] = useState(pot?.name ?? '')
  const [target, setTarget] = useState(pot ? formatInput(pot.target) : '')
  const [saved, setSaved] = useState(pot ? formatInput(pot.saved) : '')
  const [error, setError] = useState('')

  const save = () => {
    const goal = parseMoney(target)
    const held = parseMoney(saved)
    if (!name.trim() || goal == null || goal <= 0 || held == null) {
      setError('Informe o nome, a meta e quanto já está guardado.')
      return
    }
    onSave({ id: pot?.id ?? uid(), name: name.trim(), target: goal, saved: held })
    onClose()
  }

  return (
    <Modal
      title={pot ? 'Editar economia' : 'Nova economia'}
      description="A meta é o quanto vocês querem guardar. O valor guardado é o que já está separado."
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          {pot ? (
            <Button variant="danger" onClick={() => onRemove(pot)}>
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
        <MoneyField label="Meta" value={target} onChange={setTarget} />
        <MoneyField label="Já guardado" value={saved} onChange={setSaved} />
        {error ? <p className="text-sm text-clay">{error}</p> : null}
      </div>
    </Modal>
  )
}

function PlanDialog({
  plan,
  onClose,
  onSave,
  onRemove,
}: {
  plan: LeisurePlan | null
  onClose: () => void
  onSave: (plan: LeisurePlan) => void
  onRemove: (plan: LeisurePlan) => void
}) {
  const [name, setName] = useState(plan?.name ?? '')
  const [date, setDate] = useState(plan?.date ?? todayISO())
  const [amount, setAmount] = useState(plan ? formatInput(plan.amount) : '')
  const [note, setNote] = useState(plan?.note ?? '')
  const [error, setError] = useState('')

  const save = () => {
    const parsed = parseMoney(amount)
    if (!name.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date) || parsed == null || parsed <= 0) {
      setError('Informe o lazer, a data e o valor previsto.')
      return
    }
    onSave({ id: plan?.id ?? uid(), name: name.trim(), date, amount: parsed, note: note.trim() })
    onClose()
  }

  return (
    <Modal
      title={plan ? 'Editar plano' : 'Novo plano de lazer'}
      description="Isso é o plano. Quando o lazer acontecer, lance o gasto na aba Lazer."
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          {plan ? (
            <Button variant="danger" onClick={() => onRemove(plan)}>
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
        <Field label="Lazer">
          <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="Cinema, viagem, jantar" autoFocus />
        </Field>
        <Field label="Data">
          <input className={fieldClass} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </Field>
        <MoneyField label="Valor previsto" value={amount} onChange={setAmount} />
        <Field label="Nota">
          <input className={fieldClass} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
        {error ? <p className="text-sm text-clay">{error}</p> : null}
      </div>
    </Modal>
  )
}
