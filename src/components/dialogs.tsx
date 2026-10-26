import { useState } from 'react'
import { formatShort, monthTitle, parseDate, parseDay, todayISO } from '../lib/dates.ts'
import { ExpenseIcon } from './ExpenseIcon.tsx'
import { groceryInflowApplies, installmentSchedule } from '../lib/finance.ts'
import { formatBRL, formatInput, parseMoney, round2, uid } from '../lib/money.ts'
import {
  CARD_COLORS,
  COMPANY_CATEGORIES,
  COMPANY_PAYMENTS,
  FIXED_CATEGORIES,
  FIXED_ICONS,
  iconForCategory,
  PAYMENT_METHODS,
  PEOPLE,
  SPEND_CATEGORIES,
  type CashExpense,
  type CompanyDirection,
  type CompanyEntry,
  type CompanyPayment,
  type CreditCard,
  type FixedExpense,
  type FixedIconId,
  type GroceryInflow,
  type IncomeRepeat,
  type IncomeSource,
  type PaymentMethod,
  type Person,
  type Purchase,
  type SpendEntry,
} from '../lib/types.ts'
import { useStore } from '../state.tsx'
import { ConfirmDialog, Modal } from './Modal.tsx'
import { Button, Field, MoneyField, fieldClass } from './ui.tsx'

export function MoneyDialog({
  title,
  description,
  label,
  hint,
  initial,
  allowZero = true,
  onClose,
  onSave,
}: {
  title: string
  description?: string
  label: string
  hint?: string
  initial: number | null
  allowZero?: boolean
  onClose: () => void
  onSave: (value: number) => void
}) {
  const [value, setValue] = useState(initial == null ? '' : formatInput(initial))
  const [error, setError] = useState('')

  const save = () => {
    const amount = parseMoney(value)
    if (amount == null || (!allowZero && amount <= 0)) {
      setError('Informe um valor válido.')
      return
    }
    onSave(amount)
    onClose()
  }

  return (
    <Modal
      title={title}
      description={description}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={save}>Salvar</Button>
        </div>
      }
    >
      <form
        className="space-y-4 pb-2"
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
      >
        <MoneyField label={label} value={value} onChange={setValue} hint={hint} autoFocus />
        {error ? <p className="text-sm text-clay">{error}</p> : null}
      </form>
    </Modal>
  )
}

export function FixedDialog({ expense, onClose }: { expense: FixedExpense | null; onClose: () => void }) {
  const { upsertFixed, removeFixed } = useStore()
  const [name, setName] = useState(expense?.name ?? '')
  const [amount, setAmount] = useState(expense ? formatInput(expense.amount) : '')
  const [dueDay, setDueDay] = useState(String(expense?.dueDay ?? 5))
  const [startDate, setStartDate] = useState(expense ? (expense.startDate ?? '') : todayISO())
  const [category, setCategory] = useState(expense?.category ?? 'Aluguel')
  const [icon, setIcon] = useState<FixedIconId>(expense?.icon ?? iconForCategory(expense?.category ?? 'Aluguel'))
  const [iconChosen, setIconChosen] = useState(Boolean(expense))
  const [notes, setNotes] = useState(expense?.notes ?? '')
  const [active, setActive] = useState(expense?.active ?? true)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const options = FIXED_CATEGORIES.includes(category as (typeof FIXED_CATEGORIES)[number])
    ? FIXED_CATEGORIES
    : [category, ...FIXED_CATEGORIES]

  const save = () => {
    const parsedAmount = parseMoney(amount)
    const day = parseDay(dueDay)
    if (!name.trim()) {
      setError('Dê um nome para esse gasto.')
      return
    }
    if (parsedAmount == null || parsedAmount <= 0) {
      setError('Informe o valor mensal.')
      return
    }
    if (day == null) {
      setError('O vencimento fica entre os dias 1 e 31.')
      return
    }
    if (startDate && !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      setError('Informe a data inicial.')
      return
    }
    upsertFixed({
      id: expense?.id ?? uid(),
      name: name.trim(),
      amount: parsedAmount,
      dueDay: day,
      startDate: startDate || null,
      category,
      icon,
      notes: notes.trim(),
      active,
    })
    onClose()
  }

  return (
    <>
      <Modal
        title={expense ? 'Editar gasto fixo' : 'Novo gasto fixo'}
        description="Aluguel, luz, escola, internet e tudo que se repete todo mês."
        onClose={onClose}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            {expense ? (
              <Button variant="danger" onClick={() => setConfirming(true)}>
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
        <form
          className="space-y-4 pb-2"
          onSubmit={(event) => {
            event.preventDefault()
            save()
          }}
        >
          <Field label="Nome">
            <input autoFocus className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Aluguel" />
          </Field>
          <MoneyField label="Valor mensal" value={amount} onChange={setAmount} />
          <Field label="Data inicial" hint="Entra a partir desse mês. Em branco, vale desde sempre.">
            <input type="date" className={fieldClass} value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Dia do vencimento" hint="Se o mês não tiver esse dia, vale o último.">
              <input className={fieldClass} inputMode="numeric" value={dueDay} onChange={(event) => setDueDay(event.target.value)} />
            </Field>
            <Field label="Categoria">
              <select
                className={fieldClass}
                value={category}
                onChange={(event) => {
                  const next = event.target.value
                  setCategory(next)
                  if (!iconChosen) setIcon(iconForCategory(next))
                }}
              >
                {options.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </Field>
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink">Ícone</span>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {FIXED_ICONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={item.label}
                  aria-pressed={icon === item.id}
                  title={item.label}
                  onClick={() => {
                    setIcon(item.id)
                    setIconChosen(true)
                  }}
                  className={`flex h-14 flex-col items-center justify-center gap-1 rounded-xl border text-[10px] ${icon === item.id ? 'border-moss bg-moss-soft text-moss' : 'border-line bg-card text-ink'}`}
                >
                  <ExpenseIcon name={item.id} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <Field label="Observação">
            <input className={fieldClass} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Opcional" />
          </Field>
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-moss" checked={active} onChange={(event) => setActive(event.target.checked)} />
            Entra na conta
          </label>
          {error ? <p className="text-sm text-clay">{error}</p> : null}
        </form>
      </Modal>
      {confirming && expense ? (
        <ConfirmDialog
          title="Excluir gasto fixo"
          text={`“${expense.name}” sai da lista. Os meses já marcados como pagos também saem, inclusive o que foi lançado num cartão.`}
          confirmLabel="Excluir"
          onClose={() => setConfirming(false)}
          onConfirm={() => {
            removeFixed(expense.id)
            onClose()
          }}
        />
      ) : null}
    </>
  )
}

export function PayFixedDialog({ expense, month, onClose }: { expense: FixedExpense; month: string; onClose: () => void }) {
  const { state, payFixed } = useStore()
  const [cardId, setCardId] = useState('')
  const [surcharge, setSurcharge] = useState('')
  const [error, setError] = useState('')
  const extra = parseMoney(surcharge) ?? 0
  const total = round2(expense.amount + extra)

  const pay = (onCard: boolean) => {
    if (onCard && !cardId) {
      setError('Escolha o cartão.')
      return
    }
    if (surcharge.trim() && parseMoney(surcharge) == null) {
      setError('O valor de juros e multa não fechou.')
      return
    }
    payFixed(expense.id, month, onCard ? cardId : null, extra)
    onClose()
  }

  return (
    <Modal
      title={`Pagar ${expense.name}`}
      description={`${monthTitle(month)} · principal ${formatBRL(expense.amount)}`}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <div className="flex flex-wrap gap-3">
            <Button variant="ghost" onClick={() => pay(false)}>
              Saiu da conta
            </Button>
            <Button onClick={() => pay(true)} disabled={state.cards.length === 0}>
              Lançar no cartão
            </Button>
          </div>
        </div>
      }
    >
      <form
        className="space-y-4 pb-2"
        onSubmit={(event) => {
          event.preventDefault()
          pay(true)
        }}
      >
        <MoneyField
          label="Juros e multa"
          value={surcharge}
          onChange={setSurcharge}
          hint="Só neste mês. O valor fixo dos outros meses continua o principal."
        />
        <p className="text-sm text-ink">
          Neste mês sai <span className="font-medium tabular-nums">{formatBRL(total)}</span>
        </p>
        <Field label="Cartão" hint="O valor entra na fatura desse cartão e deixa de sair de novo da conta neste mês.">
          <select className={fieldClass} value={cardId} onChange={(event) => setCardId(event.target.value)}>
            <option value="">Escolha o cartão</option>
            {state.cards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.nickname}
                {card.lastFour ? ` · ${card.lastFour}` : ''}
              </option>
            ))}
          </select>
        </Field>
        {error ? <p className="text-sm text-clay">{error}</p> : null}
      </form>
    </Modal>
  )
}

export function SettleDialog({
  title,
  month,
  principal,
  confirmLabel,
  onClose,
  onConfirm,
}: {
  title: string
  month: string
  principal: number
  confirmLabel: string
  onClose: () => void
  onConfirm: (surcharge: number) => void
}) {
  const [surcharge, setSurcharge] = useState('')
  const [error, setError] = useState('')
  const extra = parseMoney(surcharge) ?? 0
  const total = round2(principal + extra)

  const pay = () => {
    if (surcharge.trim() && parseMoney(surcharge) == null) {
      setError('O valor de juros e multa não fechou.')
      return
    }
    onConfirm(extra)
    onClose()
  }

  return (
    <Modal
      title={title}
      description={`${monthTitle(month)} · principal ${formatBRL(principal)}`}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={pay}>{confirmLabel}</Button>
        </div>
      }
    >
      <form
        className="space-y-4 pb-2"
        onSubmit={(event) => {
          event.preventDefault()
          pay()
        }}
      >
        <MoneyField
          label="Juros e multa"
          value={surcharge}
          onChange={setSurcharge}
          hint="Só neste mês. O valor dos outros meses continua o principal."
        />
        <p className="text-sm text-ink">
          Neste mês sai <span className="font-medium tabular-nums">{formatBRL(total)}</span>
        </p>
        {error ? <p className="text-sm text-clay">{error}</p> : null}
      </form>
    </Modal>
  )
}

export function CardDialog({ card, onClose }: { card: CreditCard | null; onClose: () => void }) {
  const { upsertCard, removeCard, state } = useStore()
  const [nickname, setNickname] = useState(card?.nickname ?? '')
  const [lastFour, setLastFour] = useState(card?.lastFour ?? '')
  const [limit, setLimit] = useState(card && card.limit > 0 ? formatInput(card.limit) : '')
  const [closingDay, setClosingDay] = useState(String(card?.closingDay ?? 5))
  const [dueDay, setDueDay] = useState(String(card?.dueDay ?? 12))
  const [color, setColor] = useState(card?.color ?? 'forest')
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const purchases = state.purchases.filter((item) => item.cardId === card?.id).length

  const save = () => {
    const parsedLimit = limit.trim() ? parseMoney(limit) : 0
    const closing = parseDay(closingDay)
    const due = parseDay(dueDay)
    const digits = lastFour.replace(/\D/g, '')
    if (!nickname.trim()) {
      setError('Dê um nome ao cartão.')
      return
    }
    if (parsedLimit == null) {
      setError('O limite precisa ser um valor válido, ou fique em branco.')
      return
    }
    if (closing == null || due == null) {
      setError('Fechamento e vencimento ficam entre os dias 1 e 31.')
      return
    }
    if (digits && digits.length !== 4) {
      setError('O final do cartão tem 4 números.')
      return
    }
    upsertCard({
      id: card?.id ?? uid(),
      nickname: nickname.trim(),
      lastFour: digits,
      limit: parsedLimit,
      closingDay: closing,
      dueDay: due,
      color,
    })
    onClose()
  }

  return (
    <>
      <Modal
        title={card ? 'Editar cartão' : 'Novo cartão'}
        description="O fechamento define qual compra entra na fatura. O vencimento é o dia em que ela sai da conta."
        onClose={onClose}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            {card ? (
              <Button variant="danger" onClick={() => setConfirming(true)}>
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
        <form
          className="space-y-4 pb-2"
          onSubmit={(event) => {
            event.preventDefault()
            save()
          }}
        >
          <Field label="Nome do cartão">
            <input autoFocus className={fieldClass} value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="Ex.: Nubank" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Final">
              <input
                className={fieldClass}
                inputMode="numeric"
                maxLength={4}
                value={lastFour}
                onChange={(event) => setLastFour(event.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="1234"
              />
            </Field>
            <MoneyField label="Limite" value={limit} onChange={setLimit} hint="Em branco se você ainda não souber." />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Dia de fechamento">
              <input className={fieldClass} inputMode="numeric" value={closingDay} onChange={(event) => setClosingDay(event.target.value)} />
            </Field>
            <Field label="Dia de vencimento">
              <input className={fieldClass} inputMode="numeric" value={dueDay} onChange={(event) => setDueDay(event.target.value)} />
            </Field>
          </div>
          <Field label="Cor">
            <div className="flex flex-wrap gap-2 pt-1">
              {CARD_COLORS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={item.label}
                  aria-pressed={color === item.id}
                  onClick={() => setColor(item.id)}
                  className={`h-9 w-9 rounded-full ${color === item.id ? 'ring-2 ring-ink ring-offset-2' : ''}`}
                  style={{ background: `linear-gradient(140deg, ${item.from}, ${item.to})` }}
                />
              ))}
            </div>
          </Field>
          {error ? <p className="text-sm text-clay">{error}</p> : null}
        </form>
      </Modal>
      {confirming && card ? (
        <ConfirmDialog
          title="Excluir cartão"
          text={
            purchases > 0
              ? `“${card.nickname}” e ${purchases} compra(s) lançada(s) nele serão apagados.`
              : `“${card.nickname}” será apagado.`
          }
          confirmLabel="Excluir"
          onClose={() => setConfirming(false)}
          onConfirm={() => {
            removeCard(card.id)
            onClose()
          }}
        />
      ) : null}
    </>
  )
}

export function PurchaseDialog({
  cardId,
  purchase,
  onClose,
}: {
  cardId: string
  purchase: Purchase | null
  onClose: () => void
}) {
  const { state, upsertPurchase, removePurchase, addCustomCategory, removeCustomCategory } = useStore()
  const [description, setDescription] = useState(purchase?.description ?? '')
  const [amount, setAmount] = useState(purchase ? formatInput(purchase.amount) : '')
  const [date, setDate] = useState(purchase?.date ?? todayISO())
  const [installments, setInstallments] = useState(String(purchase?.installments ?? 1))
  const [category, setCategory] = useState(purchase?.category ?? 'outro')
  const [addingCategory, setAddingCategory] = useState(false)
  const [newCategory, setNewCategory] = useState('')
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const parsedAmount = parseMoney(amount)
  const count = Math.min(24, Math.max(1, Math.round(Number(installments)) || 1))
  const preview =
    parsedAmount && parsedAmount > 0
      ? installmentSchedule({ amount: parsedAmount, installments: count, date }).map((item) => item.amount)
      : []

  const save = () => {
    if (!description.trim()) {
      setError('Descreva a compra.')
      return
    }
    if (parsedAmount == null || parsedAmount <= 0) {
      setError('Informe o valor total da compra.')
      return
    }
    if (!date) {
      setError('Informe a data da compra.')
      return
    }
    if (!Number.isInteger(Number(installments)) || count < 1 || count > 24) {
      setError('As parcelas vão de 1 a 24.')
      return
    }
    upsertPurchase({
      id: purchase?.id ?? uid(),
      cardId,
      description: description.trim(),
      amount: parsedAmount,
      installments: count,
      date,
      category,
    })
    onClose()
  }

  return (
    <>
      <Modal
        title={purchase ? 'Editar compra' : 'Nova compra'}
        description="Na meta, à vista entra no dia da compra e o parcelado entra pela parcela de cada mês. A fatura recebe a mesma parcela."
        onClose={onClose}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            {purchase ? (
              <Button variant="danger" onClick={() => setConfirming(true)}>
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
        <form
          className="space-y-4 pb-2"
          onSubmit={(event) => {
            event.preventDefault()
            save()
          }}
        >
          <Field label="Descrição">
            <input autoFocus className={fieldClass} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: Supermercado" />
          </Field>
          <MoneyField label="Valor total" value={amount} onChange={setAmount} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Data da compra">
              <input type="date" className={fieldClass} value={date} onChange={(event) => setDate(event.target.value)} />
            </Field>
            <Field label="Parcelas">
              <input className={fieldClass} inputMode="numeric" value={installments} onChange={(event) => setInstallments(event.target.value)} />
            </Field>
          </div>
          <Field label="Categoria">
            <select className={fieldClass} value={category} onChange={(event) => setCategory(event.target.value)}>
              {SPEND_CATEGORIES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
              {state.customCategories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          {addingCategory ? (
            <div className="flex gap-2">
              <input
                className={fieldClass}
                value={newCategory}
                placeholder="Ex.: Pet"
                onChange={(event) => setNewCategory(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  event.preventDefault()
                  if (!newCategory.trim()) return
                  setCategory(addCustomCategory(newCategory))
                  setNewCategory('')
                  setAddingCategory(false)
                }}
              />
              <Button
                type="button"
                onClick={() => {
                  if (!newCategory.trim()) return
                  setCategory(addCustomCategory(newCategory))
                  setNewCategory('')
                  setAddingCategory(false)
                }}
              >
                Salvar categoria
              </Button>
            </div>
          ) : (
            <button type="button" onClick={() => setAddingCategory(true)} className="text-sm font-medium text-moss">
              Cadastrar categoria
            </button>
          )}
          {state.customCategories.some((item) => item.id === category) ? (
            <button
              type="button"
              className="text-sm font-medium text-clay"
              onClick={() => {
                removeCustomCategory(category)
                setCategory('outro')
              }}
            >
              Excluir esta categoria
            </button>
          ) : null}
          {preview.length > 1 ? (
            <p className="rounded-xl bg-paper px-3 py-2 text-sm text-ink-soft">
              {preview.length}x de {formatBRL(preview[0] ?? 0)}
              {preview[preview.length - 1] !== preview[0] ? ` (última ${formatBRL(preview[preview.length - 1] ?? 0)})` : ''}
            </p>
          ) : null}
          {error ? <p className="text-sm text-clay">{error}</p> : null}
        </form>
      </Modal>
      {confirming && purchase ? (
        <ConfirmDialog
          title="Excluir compra"
          text="A compra sai do cartão e, se for mercado, lazer ou combustível, sai da meta também."
          confirmLabel="Excluir"
          onClose={() => setConfirming(false)}
          onConfirm={() => {
            removePurchase(purchase.id)
            onClose()
          }}
        />
      ) : null}
    </>
  )
}

export function SpendDialog({
  category,
  entry,
  onClose,
}: {
  category: 'mercado' | 'lazer' | 'combustivel'
  entry: SpendEntry | null
  onClose: () => void
}) {
  const { state, saveSpend, removeSpend } = useStore()
  const existingPurchase = entry?.source === 'card' ? state.purchases.find((item) => item.id === entry.id) : undefined
  const existingCash = entry?.source === 'cash' ? state.cashExpenses.find((item) => item.id === entry.id) : undefined
  const [description, setDescription] = useState(entry?.description ?? '')
  const [amount, setAmount] = useState(entry ? formatInput(entry.amount) : '')
  const [date, setDate] = useState(entry?.date ?? todayISO())
  const [method, setMethod] = useState(
    existingPurchase ? 'cartao' : existingCash?.inflowId ? `fonte:${existingCash.inflowId}` : (existingCash?.method ?? 'pix'),
  )
  const [cardId, setCardId] = useState(existingPurchase?.cardId ?? state.cards[0]?.id ?? '')
  const [installments, setInstallments] = useState(String(existingPurchase?.installments ?? 1))
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const title = category === 'mercado' ? 'Compra de mercado' : category === 'combustivel' ? 'Abastecimento' : 'Gasto de lazer'
  const purchaseMonth = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 7) : ''
  const fontes = category === 'mercado'
    ? state.groceryInflows.filter((item) => purchaseMonth && groceryInflowApplies(item, purchaseMonth))
    : []
  const selectedFonte = method.startsWith('fonte:')
    ? state.groceryInflows.find((item) => item.id === method.slice('fonte:'.length))
    : undefined
  const fonteOptions = selectedFonte && !fontes.some((item) => item.id === selectedFonte.id) ? [selectedFonte, ...fontes] : fontes

  const save = () => {
    const parsedAmount = parseMoney(amount)
    if (!description.trim()) {
      setError('Descreva o lançamento.')
      return
    }
    if (parsedAmount == null || parsedAmount <= 0) {
      setError('Informe o valor.')
      return
    }
    if (!date) {
      setError('Informe a data.')
      return
    }
    const id = entry?.id ?? uid()
    const inflowId = method.startsWith('fonte:') ? method.slice('fonte:'.length) : null
    if (inflowId && !state.groceryInflows.some((item) => item.id === inflowId)) {
      setError('Essa fonte de entrada não existe mais.')
      return
    }
    if (method === 'cartao') {
      if (!cardId) {
        setError('Cadastre um cartão ou escolha Pix, débito ou dinheiro.')
        return
      }
      const count = Math.round(Number(installments))
      if (!Number.isInteger(count) || count < 1 || count > 24) {
        setError('As parcelas vão de 1 a 24.')
        return
      }
      saveSpend(entry, {
        kind: 'card',
        purchase: { id, cardId, description: description.trim(), amount: parsedAmount, installments: count, date, category },
      })
    } else {
      const expense: CashExpense = {
        id,
        description: description.trim(),
        amount: parsedAmount,
        date,
        category,
        method: inflowId ? 'pix' : (method as PaymentMethod),
        inflowId,
      }
      saveSpend(entry, { kind: 'cash', expense })
    }
    onClose()
  }

  return (
    <>
      <Modal
        title={entry ? `Editar ${title.toLowerCase()}` : title}
        description="À vista entra na meta no dia da compra. No cartão parcelado, entra uma parcela por mês."
        onClose={onClose}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            {entry ? (
              <Button variant="danger" onClick={() => setConfirming(true)}>
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
        <form
          className="space-y-4 pb-2"
          onSubmit={(event) => {
            event.preventDefault()
            save()
          }}
        >
          <Field label="Descrição">
            <input
              autoFocus
              className={fieldClass}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={category === 'mercado' ? 'Ex.: Hortifruti' : category === 'combustivel' ? 'Ex.: Posto' : 'Ex.: Cinema'}
            />
          </Field>
          <MoneyField label="Valor" value={amount} onChange={setAmount} />
          <Field label="Data">
            <input type="date" className={fieldClass} value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field label="Como foi pago">
            <select
              className={fieldClass}
              value={method}
              onChange={(event) => setMethod(event.target.value as 'cartao' | PaymentMethod)}
            >
              <option value="cartao">Cartão de crédito</option>
              {PAYMENT_METHODS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
              {fonteOptions.map((item) => (
                <option key={item.id} value={`fonte:${item.id}`}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
          {category === 'mercado' && fonteOptions.length === 0 ? (
            <p className="-mt-2 text-xs text-ink-soft">Para pagar com vale alimentação, cadastre a fonte de entrada neste mês.</p>
          ) : null}
          {method === 'cartao' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Cartão">
                <select className={fieldClass} value={cardId} onChange={(event) => setCardId(event.target.value)}>
                  {state.cards.length === 0 ? <option value="">Nenhum cartão</option> : null}
                  {state.cards.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.nickname}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Parcelas">
                <input className={fieldClass} inputMode="numeric" value={installments} onChange={(event) => setInstallments(event.target.value)} />
              </Field>
            </div>
          ) : null}
          {error ? <p className="text-sm text-clay">{error}</p> : null}
        </form>
      </Modal>
      {confirming && entry ? (
        <ConfirmDialog
          title="Excluir lançamento"
          text={entry.source === 'card' ? 'A compra também sai da fatura do cartão.' : 'Esse lançamento será apagado.'}
          confirmLabel="Excluir"
          onClose={() => setConfirming(false)}
          onConfirm={() => {
            removeSpend(entry)
            onClose()
          }}
        />
      ) : null}
    </>
  )
}

export function GroceryInflowDialog({ month, entry, onClose }: { month: string; entry: GroceryInflow | null; onClose: () => void }) {
  const { upsertGroceryInflow, removeGroceryInflow } = useStore()
  const [name, setName] = useState(entry?.name ?? 'Vale alimentação')
  const [amount, setAmount] = useState(entry ? formatInput(entry.amount) : '')
  const [repeat, setRepeat] = useState<'monthly' | 'once'>(entry?.repeat ?? 'once')
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)

  const save = () => {
    const parsed = parseMoney(amount)
    if (!name.trim()) {
      setError('Diga de onde veio, por exemplo vale alimentação.')
      return
    }
    if (parsed == null || parsed <= 0) {
      setError('Informe o valor.')
      return
    }
    upsertGroceryInflow({
      id: entry?.id ?? uid(),
      name: name.trim(),
      amount: parsed,
      month: entry?.month ?? month,
      repeat,
    })
    onClose()
  }

  return (
    <>
      <Modal
        title={entry ? 'Editar fonte de entrada' : 'Fonte de entrada'}
        description="Esse valor entra na meta de mercado do mês. A compra em si continua sendo lançada à parte."
        onClose={onClose}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            {entry ? (
              <Button variant="danger" onClick={() => setConfirming(true)}>
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
        <form
          className="space-y-4 pb-2"
          onSubmit={(event) => {
            event.preventDefault()
            save()
          }}
        >
          <Field label="Nome">
            <input autoFocus className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="Vale alimentação" />
          </Field>
          <MoneyField label="Valor" value={amount} onChange={setAmount} />
          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink">Quando entra</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={repeat === 'once'}
                onClick={() => setRepeat('once')}
                className={`rounded-xl border px-3 py-2.5 text-sm ${repeat === 'once' ? 'border-moss bg-moss-soft text-moss' : 'border-line bg-card'}`}
              >
                Só neste mês
              </button>
              <button
                type="button"
                aria-pressed={repeat === 'monthly'}
                onClick={() => setRepeat('monthly')}
                className={`rounded-xl border px-3 py-2.5 text-sm ${repeat === 'monthly' ? 'border-moss bg-moss-soft text-moss' : 'border-line bg-card'}`}
              >
                Todo mês
              </button>
            </div>
          </div>
          {error ? <p className="text-sm text-clay">{error}</p> : null}
        </form>
      </Modal>
      {confirming && entry ? (
        <ConfirmDialog
          title="Excluir entrada"
          text={`“${entry.name}” sai da meta de mercado.`}
          confirmLabel="Excluir"
          onClose={() => setConfirming(false)}
          onConfirm={() => {
            removeGroceryInflow(entry.id)
            onClose()
          }}
        />
      ) : null}
    </>
  )
}

export function IncomeDialog({ onClose }: { onClose: () => void }) {
  const { state, upsertIncome, removeIncome } = useStore()
  const [editing, setEditing] = useState<IncomeSource | null>(null)
  const [creating, setCreating] = useState(state.incomes.length === 0)
  const [person, setPerson] = useState<Person>('sara')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(todayISO())
  const [repeat, setRepeat] = useState<IncomeRepeat>('monthly')
  const [error, setError] = useState('')
  const [removing, setRemoving] = useState<IncomeSource | null>(null)
  const open = creating || editing != null
  const migrated = state.incomes.some((item) => item.id === 'renda-inicial' && item.person === 'sara' && item.name === 'Renda da casa')

  const startCreate = () => {
    setEditing(null)
    setCreating(true)
    setPerson('sara')
    setName('')
    setAmount('')
    setDate(todayISO())
    setRepeat('monthly')
    setError('')
  }

  const startEdit = (source: IncomeSource) => {
    setCreating(false)
    setEditing(source)
    setPerson(source.person)
    setName(source.name)
    setAmount(formatInput(source.amount))
    setDate(source.date ?? todayISO())
    setRepeat(source.repeat)
    setError('')
  }

  const save = () => {
    const parsed = parseMoney(amount)
    if (!name.trim()) {
      setError('Diga o que é essa renda. Salário, benefício, extra.')
      return
    }
    if (parsed == null || parsed <= 0) {
      setError('Informe o valor.')
      return
    }
    if (!date) {
      setError('Escolha a data.')
      return
    }
    upsertIncome({
      id: editing?.id ?? uid(),
      person,
      name: name.trim(),
      amount: parsed,
      date,
      repeat,
    })
    setCreating(false)
    setEditing(null)
    setName('')
    setAmount('')
    setDate(todayISO())
    setRepeat('monthly')
    setError('')
  }

  return (
    <>
    <Modal
      title="Renda da casa"
      description="Cada valor diz de quem vem e quando cai: todo mês a partir de uma data, ou só naquele dia."
      onClose={onClose}
      footer={
        <div className="flex flex-wrap justify-end gap-3">
          {open ? (
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setCreating(false)
                  setEditing(null)
                  setError('')
                }}
              >
                Cancelar
              </Button>
              <Button onClick={save}>Salvar</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={onClose}>
                Fechar
              </Button>
              <Button onClick={startCreate}>Nova origem</Button>
            </>
          )}
        </div>
      }
    >
      <div className="space-y-4 pb-2">
        {migrated ? (
          <p className="rounded-xl bg-paper px-3 py-2 text-sm leading-relaxed text-ink-soft">
            A renda que você já tinha lançado ficou na Sara. Troque a origem para o Vinicius, ou divida em duas.
          </p>
        ) : null}
        {state.incomes.length > 0 ? (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {state.incomes.map((source) => (
              <li key={source.id} className="flex items-center gap-3 px-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{source.name}</p>
                  <p className="text-xs text-ink-soft">{incomeWhen(source)}</p>
                </div>
                <span className="text-sm tabular-nums">{formatBRL(source.amount)}</span>
                <button type="button" className="text-sm font-medium text-moss" onClick={() => startEdit(source)}>
                  Editar
                </button>
                <button type="button" className="text-sm text-clay" onClick={() => setRemoving(source)}>
                  Excluir
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {open ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault()
              save()
            }}
          >
            <div>
              <span className="mb-1.5 block text-sm font-medium text-ink">De quem é</span>
              <div className="grid grid-cols-2 gap-2">
                {PEOPLE.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={person === item.id}
                    onClick={() => setPerson(item.id)}
                    className={`h-10 rounded-xl border text-sm font-medium ${person === item.id ? 'border-moss bg-moss-soft text-moss' : 'border-line bg-card text-ink'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <Field label="O que é">
              <input autoFocus className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Salário" />
            </Field>
            <div>
              <span className="mb-1.5 block text-sm font-medium text-ink">Quando entra</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-pressed={repeat === 'monthly'}
                  onClick={() => setRepeat('monthly')}
                  className={`h-10 rounded-xl border text-sm font-medium ${repeat === 'monthly' ? 'border-moss bg-moss-soft text-moss' : 'border-line bg-card text-ink'}`}
                >
                  Todo mês
                </button>
                <button
                  type="button"
                  aria-pressed={repeat === 'once'}
                  onClick={() => setRepeat('once')}
                  className={`h-10 rounded-xl border text-sm font-medium ${repeat === 'once' ? 'border-moss bg-moss-soft text-moss' : 'border-line bg-card text-ink'}`}
                >
                  Só nesta data
                </button>
              </div>
            </div>
            <Field label={repeat === 'monthly' ? 'A partir de' : 'Data'} hint={repeat === 'monthly' ? 'Entra neste mês e nos seguintes, no dia escolhido.' : 'Entra só no mês dessa data.'}>
              <input type="date" className={fieldClass} value={date} onChange={(event) => setDate(event.target.value)} />
            </Field>
            <MoneyField label={repeat === 'monthly' ? 'Valor mensal' : 'Valor'} value={amount} onChange={setAmount} />
            {error ? <p className="text-sm text-clay">{error}</p> : null}
          </form>
        ) : null}
      </div>
    </Modal>
    {removing ? (
      <ConfirmDialog
        title="Excluir renda"
        text={`“${removing.name}” sai da renda da ${removing.person === 'sara' ? 'Sara' : 'Vinicius'}.`}
        confirmLabel="Excluir"
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          removeIncome(removing.id)
          setRemoving(null)
        }}
      />
    ) : null}
    </>
  )
}

function incomeWhen(source: IncomeSource): string {
  const who = source.person === 'sara' ? 'Sara' : 'Vinicius'
  if (!source.date) return `${who} · todo mês`
  const when = parseDate(source.date)
  if (source.repeat === 'once') return `${who} · só em ${formatShort(when)}`
  return `${who} · todo dia ${when.getDate()}, desde ${formatShort(when)}`
}

export function LinkLaunchDialog({ onClose }: { onClose: () => void }) {
  const { state, upsertCompany } = useStore()
  const [method, setMethod] = useState<CompanyPayment | ''>('')
  const [cardId, setCardId] = useState(state.cards[0]?.id ?? '')
  const [amount, setAmount] = useState('')
  const parsed = parseMoney(amount)
  const linked = new Set(state.companyEntries.map((entry) => entry.purchaseId).filter((id): id is string => Boolean(id)))
  const matches = method === 'cartao' && cardId && parsed != null
    ? state.purchases.filter((purchase) => {
        if (purchase.cardId !== cardId || linked.has(purchase.id)) return false
        if (Math.abs(purchase.amount - parsed) < 0.01) return true
        return installmentSchedule(purchase).some((item) => Math.abs(item.amount - parsed) < 0.05)
      })
    : []

  return (
    <Modal
      title="Buscar lançamento"
      description="Escolha cartão de crédito, o cartão e o valor. A compra que já está em Cartões entra na empresa e não se repete na fatura."
      onClose={onClose}
      footer={
        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pb-2">
        <Field label="Forma de pagamento">
          <select className={fieldClass} value={method} onChange={(event) => setMethod(event.target.value as CompanyPayment | '')}>
            <option value="">Escolher</option>
            {COMPANY_PAYMENTS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
        {method === 'cartao' ? (
          <Field label="Cartão">
            <select className={fieldClass} value={cardId} onChange={(event) => setCardId(event.target.value)}>
              {state.cards.length === 0 ? <option value="">Nenhum cartão</option> : null}
              {state.cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.nickname}
                </option>
              ))}
            </select>
          </Field>
        ) : method ? (
          <p className="text-sm text-ink-soft">Dá para vincular uma compra que já está em Cartões. Escolha cartão de crédito.</p>
        ) : null}
        {method === 'cartao' && cardId ? (
          <MoneyField label="Valor" value={amount} onChange={setAmount} />
        ) : null}
        {method === 'cartao' && cardId && parsed != null ? (
          matches.length === 0 ? (
            <p className="text-sm text-ink-soft">Nenhuma compra com esse valor neste cartão.</p>
          ) : (
            <ul className="divide-y divide-line rounded-xl border border-line">
              {matches.slice(0, 12).map((purchase) => (
                <li key={purchase.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
                    onClick={() => {
                      upsertCompany({
                        id: uid(),
                        direction: 'saida',
                        description: purchase.description,
                        amount: purchase.amount,
                        date: purchase.date,
                        category: 'Fornecedor',
                        method: 'cartao',
                        cardId: purchase.cardId,
                        installments: purchase.installments,
                        purchaseId: purchase.id,
                        repeat: 'once',
                      })
                      onClose()
                    }}
                  >
                    <span>
                      <span className="block text-sm font-medium">{purchase.description}</span>
                      <span className="block text-xs text-ink-soft">
                        {formatShort(parseDate(purchase.date))}
                        {purchase.installments > 1 ? ` · ${purchase.installments}x` : ' · à vista'}
                      </span>
                    </span>
                    <span className="text-sm tabular-nums">{formatBRL(purchase.amount)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>
    </Modal>
  )
}

export function CompanyDialog({ entry, onClose }: { entry: CompanyEntry | null; onClose: () => void }) {
  const { state, upsertCompany, removeCompany } = useStore()
  const [direction, setDirection] = useState<CompanyDirection>(entry?.direction ?? 'saida')
  const [description, setDescription] = useState(entry?.description ?? '')
  const [amount, setAmount] = useState(entry ? formatInput(entry.amount) : '')
  const [date, setDate] = useState(entry?.date ?? todayISO())
  const [category, setCategory] = useState(entry?.category ?? 'Outro')
  const [method, setMethod] = useState<CompanyPayment>(entry?.method ?? 'pix')
  const [cardId, setCardId] = useState(entry?.cardId ?? state.cards[0]?.id ?? '')
  const [installments, setInstallments] = useState(String(entry?.installments ?? 1))
  const [repeat, setRepeat] = useState<'once' | 'monthly'>(entry?.repeat ?? 'once')
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)

  const save = () => {
    const parsed = parseMoney(amount)
    if (!description.trim()) {
      setError('Descreva o movimento.')
      return
    }
    if (parsed == null || parsed <= 0) {
      setError('Informe o valor.')
      return
    }
    if (!date) {
      setError('Informe a data.')
      return
    }
    const payByCard = direction === 'saida' && method === 'cartao'
    if (payByCard && !cardId) {
      setError('Cadastre um cartão ou escolha outra forma de pagamento.')
      return
    }
    const count = Math.round(Number(installments))
    if (payByCard && repeat === 'once' && (!Number.isInteger(count) || count < 1 || count > 24)) {
      setError('As parcelas vão de 1 a 24.')
      return
    }
    upsertCompany({
      id: entry?.id ?? uid(),
      direction,
      description: description.trim(),
      amount: parsed,
      date,
      category,
      method,
      cardId: payByCard ? cardId : null,
      installments: payByCard && repeat === 'once' ? count : 1,
      purchaseId: payByCard ? (entry?.purchaseId ?? null) : null,
      repeat,
    })
    onClose()
  }

  return (
    <>
      <Modal
        title={entry ? 'Editar movimento' : 'Movimento da empresa'}
        description="Entrada soma na renda da casa. Saída soma no que sai da casa."
        onClose={onClose}
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3">
            {entry ? (
              <Button variant="danger" onClick={() => setConfirming(true)}>
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
        <form
          className="space-y-4 pb-2"
          onSubmit={(event) => {
            event.preventDefault()
            save()
          }}
        >
          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink">Tipo</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={direction === 'entrada'}
                onClick={() => setDirection('entrada')}
                className={`h-10 rounded-xl border text-sm font-medium ${direction === 'entrada' ? 'border-moss bg-moss-soft text-moss' : 'border-line bg-card'}`}
              >
                Entrada
              </button>
              <button
                type="button"
                aria-pressed={direction === 'saida'}
                onClick={() => setDirection('saida')}
                className={`h-10 rounded-xl border text-sm font-medium ${direction === 'saida' ? 'border-clay bg-clay-soft text-clay' : 'border-line bg-card'}`}
              >
                Saída
              </button>
            </div>
          </div>
          <Field label="Descrição">
            <input autoFocus className={fieldClass} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex.: Cliente ou fornecedor" />
          </Field>
          <MoneyField label={repeat === 'monthly' ? 'Valor mensal' : 'Valor'} value={amount} onChange={setAmount} />
          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink">Quando acontece</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={repeat === 'once'}
                onClick={() => setRepeat('once')}
                className={`h-10 rounded-xl border text-sm font-medium ${repeat === 'once' ? 'border-moss bg-moss-soft text-moss' : 'border-line bg-card'}`}
              >
                Só nesta data
              </button>
              <button
                type="button"
                aria-pressed={repeat === 'monthly'}
                onClick={() => setRepeat('monthly')}
                className={`h-10 rounded-xl border text-sm font-medium ${repeat === 'monthly' ? 'border-moss bg-moss-soft text-moss' : 'border-line bg-card'}`}
              >
                Todo mês
              </button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={repeat === 'monthly' ? 'A partir de' : 'Data'} hint={repeat === 'monthly' ? 'Entra neste mês e nos seguintes, no mesmo dia.' : undefined}>
              <input type="date" className={fieldClass} value={date} onChange={(event) => setDate(event.target.value)} />
            </Field>
            <Field label="Categoria">
              <select className={fieldClass} value={category} onChange={(event) => setCategory(event.target.value)}>
                {COMPANY_CATEGORIES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Forma de pagamento">
            <select className={fieldClass} value={method} onChange={(event) => setMethod(event.target.value as CompanyPayment)}>
              {COMPANY_PAYMENTS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>
          {direction === 'saida' && method === 'cartao' ? (
            <p className="text-xs leading-relaxed text-ink-soft">
              {repeat === 'monthly'
                ? 'Todo mês esse valor entra na fatura do ciclo daquele dia. Na conta da casa ele sai no mês de cada fatura.'
                : 'Esse valor entra na fatura do cartão. Na conta da casa ele sai no mês da fatura, uma vez só.'}
            </p>
          ) : null}
          {direction === 'saida' && method === 'cartao' ? (
            <div className={`grid gap-4 ${repeat === 'once' ? 'sm:grid-cols-2' : ''}`}>
              <Field label="Cartão">
                <select className={fieldClass} value={cardId} onChange={(event) => setCardId(event.target.value)}>
                  {state.cards.length === 0 ? <option value="">Nenhum cartão</option> : null}
                  {state.cards.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.nickname}
                    </option>
                  ))}
                </select>
              </Field>
              {repeat === 'once' ? (
                <Field label="Parcelas">
                  <input className={fieldClass} inputMode="numeric" value={installments} onChange={(event) => setInstallments(event.target.value)} />
                </Field>
              ) : null}
            </div>
          ) : null}
          {error ? <p className="text-sm text-clay">{error}</p> : null}
        </form>
      </Modal>
      {confirming && entry ? (
        <ConfirmDialog
          title="Excluir movimento"
          text="Esse valor sai da empresa e também da conta da casa."
          confirmLabel="Excluir"
          onClose={() => setConfirming(false)}
          onConfirm={() => {
            removeCompany(entry.id)
            onClose()
          }}
        />
      ) : null}
    </>
  )
}
