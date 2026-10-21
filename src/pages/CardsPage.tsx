import { useState } from 'react'
import { CardDialog, PurchaseDialog } from '../components/dialogs.tsx'
import { Button, EmptyState, PageIntro, Panel } from '../components/ui.tsx'
import { formatFriendly, formatShort, monthKey, monthTitle, shiftMonth } from '../lib/dates.ts'
import { billingMonthForDue, invoiceDueDate, invoiceForCard, limitUsed, openInvoiceMonth, type InvoiceLine } from '../lib/finance.ts'
import { formatBRL, round2 } from '../lib/money.ts'
import { cardPalette, categoryLabel, type CreditCard, type CustomCategory, type Purchase } from '../lib/types.ts'
import { useStore } from '../state.tsx'

export function CardsPage() {
  const { state, today, setPage } = useStore()
  const [editing, setEditing] = useState<CreditCard | null | 'new'>(null)

  return (
    <div>
      <PageIntro
        eyebrow="Crédito"
        title="Cartões"
        description="Cada compra fica dentro do cartão. A fatura junta o que fecha naquele ciclo, já com as parcelas."
        action={<Button onClick={() => setEditing('new')}>Novo cartão</Button>}
      />

      {state.cards.length === 0 ? (
        <EmptyState
          title="Nenhum cartão"
          text="Cadastre os cartões da casa com limite, dia de fechamento e dia de vencimento."
          action={<Button onClick={() => setEditing('new')}>Cadastrar cartão</Button>}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {state.cards.map((card) => {
            const used = limitUsed(card, state, today)
            const open = openInvoiceMonth(today, card.closingDay)
            const invoice = invoiceForCard(card, state.purchases, open.year, open.monthIndex, state.paidInvoices, state.companyEntries)
            const palette = cardPalette(card.color)
            const ratio = card.limit > 0 ? Math.min(used / card.limit, 1) : 0
            return (
              <article key={card.id} className="overflow-hidden rounded-2xl border border-line bg-card">
                <button type="button" onClick={() => setPage({ id: 'card', cardId: card.id })} className="block w-full text-left">
                  <div className="m-4 rounded-2xl px-5 py-5 text-white" style={{ background: `linear-gradient(145deg, ${palette.from}, ${palette.to})` }}>
                    <p className="text-xs tracking-[0.16em] text-white/70 uppercase">Fatura aberta</p>
                    <p className="mt-2 font-serif text-3xl">{card.nickname}</p>
                    <p className="mt-6 tracking-[0.22em]">•••• {card.lastFour || '••••'}</p>
                    <div className="mt-4 flex justify-between text-xs text-white/80">
                      <span>Fecha dia {card.closingDay}</span>
                      <span>Vence dia {card.dueDay}</span>
                    </div>
                  </div>
                </button>
                <div className="px-5 pb-5">
                  <div className="flex items-baseline justify-between">
                    <p className="text-sm text-ink-soft">Fecha {formatShort(invoice.closing)}</p>
                    <p className="font-serif text-2xl tabular-nums">{formatBRL(invoice.total)}</p>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-track">
                    <div className={`h-full rounded-full ${card.limit > 0 && used > card.limit ? 'bg-clay' : 'bg-moss'}`} style={{ width: `${card.limit > 0 ? ratio * 100 : 0}%` }} />
                  </div>
                  <p className="mt-2 text-xs text-ink-soft">
                    {card.limit > 0
                      ? `${formatBRL(used)} comprometidos · ${formatBRL(Math.max(0, round2(card.limit - used)))} livres de ${formatBRL(card.limit)}`
                      : 'Informe o limite para acompanhar o que ainda cabe.'}
                  </p>
                  <div className="mt-4 flex gap-2">
                    <Button className="h-9" onClick={() => setPage({ id: 'card', cardId: card.id })}>
                      Abrir fatura
                    </Button>
                    <Button variant="ghost" className="h-9" onClick={() => setEditing(card)}>
                      Editar
                    </Button>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {editing !== null ? <CardDialog card={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
    </div>
  )
}

export function CardDetail({ cardId }: { cardId: string }) {
  const { state, today, setPage, toggleInvoicePaid } = useStore()
  const card = state.cards.find((item) => item.id === cardId)
  const open = card ? openInvoiceMonth(today, card.closingDay) : { year: today.getFullYear(), monthIndex: today.getMonth() }
  const openDue = card ? invoiceDueDate(open.year, open.monthIndex, card.closingDay, card.dueDay) : new Date(open.year, open.monthIndex, 1)
  const [dueMonth, setDueMonth] = useState(monthKey(openDue))
  const [purchase, setPurchase] = useState<Purchase | null | 'new'>(null)
  const [editingCard, setEditingCard] = useState(false)

  if (!card) {
    return (
      <EmptyState
        title="Cartão não encontrado"
        text="Ele pode ter sido excluído nesta cópia dos dados."
        action={<Button onClick={() => setPage({ id: 'cards' })}>Voltar aos cartões</Button>}
      />
    )
  }

  const billing = billingMonthForDue(dueMonth, card.closingDay, card.dueDay)
  const invoice = invoiceForCard(card, state.purchases, billing.year, billing.monthIndex, state.paidInvoices, state.companyEntries)
  const used = limitUsed(card, state, today)
  const palette = cardPalette(card.color)
  const purchases = state.purchases.filter((item) => item.cardId === card.id)
  const avista = invoice.lines.filter((line) => line.installments <= 1)
  const parceladas = invoice.lines.filter((line) => line.installments > 1)
  const openPurchase = (line: InvoiceLine) => {
    const found = purchases.find((item) => item.id === line.purchaseId)
    if (found) setPurchase(found)
  }

  return (
    <div>
      <button type="button" onClick={() => setPage({ id: 'cards' })} className="text-sm font-medium text-moss">
        Todos os cartões
      </button>
      <div className="mt-4 grid gap-4 lg:grid-cols-[280px_1fr]">
        <div>
          <div className="rounded-2xl px-5 py-5 text-white" style={{ background: `linear-gradient(145deg, ${palette.from}, ${palette.to})` }}>
            <p className="text-xs tracking-[0.16em] text-white/70 uppercase">Cartão</p>
            <p className="mt-2 font-serif text-3xl">{card.nickname}</p>
            <p className="mt-8 tracking-[0.22em]">•••• {card.lastFour || '••••'}</p>
            <div className="mt-4 flex justify-between text-xs text-white/80">
              <span>Fecha dia {card.closingDay}</span>
              <span>Vence dia {card.dueDay}</span>
            </div>
          </div>
          <Panel className="mt-4" title="Limite">
            <p className="font-serif text-3xl tabular-nums">{card.limit > 0 ? formatBRL(Math.max(0, round2(card.limit - used))) : '—'}</p>
            <p className="mt-1 text-sm text-ink-soft">
              {card.limit > 0 ? `${formatBRL(used)} comprometidos de ${formatBRL(card.limit)}` : 'Limite ainda não informado.'}
            </p>
            <p className="mt-3 text-xs leading-relaxed text-ink-soft">
À vista e parcelas em aberto ocupam o limite, mesmo com a fatura vencida. Marcar como paga libera esse valor.
            </p>
            <Button variant="ghost" className="mt-4 h-9 px-3" onClick={() => setEditingCard(true)}>
              Editar cartão
            </Button>
          </Panel>
        </div>

        <div>
          <Panel
            title="Fatura"
            action={
              <Button className="h-9" onClick={() => setPurchase('new')}>
                Nova compra
              </Button>
            }
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Fatura anterior" onClick={() => setDueMonth(shiftMonth(dueMonth, -1))} className="grid h-9 w-9 place-items-center rounded-full hover:bg-paper">
                  <Chevron />
                </button>
                <p className="min-w-36 text-center text-sm font-medium">{monthTitle(dueMonth)}</p>
                <button type="button" aria-label="Próxima fatura" onClick={() => setDueMonth(shiftMonth(dueMonth, 1))} className="grid h-9 w-9 place-items-center rounded-full hover:bg-paper">
                  <Chevron direction="right" />
                </button>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-moss"
                  checked={invoice.paid}
                  onChange={() => toggleInvoicePaid(card.id, invoice.year, invoice.monthIndex)}
                />
                Fatura paga
              </label>
            </div>
            <p className="font-serif text-4xl tabular-nums">{formatBRL(invoice.total)}</p>
            <p className="mt-1 text-sm text-ink-soft">
              Fecha {formatShort(invoice.closing)} · vence {formatShort(invoice.due)}
            </p>
            {invoice.lines.length === 0 ? <p className="mt-6 text-sm text-ink-soft">Nada nesta fatura.</p> : null}
          </Panel>

          <Panel title="À vista" className="mt-4">
            <InvoiceLines lines={avista} today={today} custom={state.customCategories} onOpen={openPurchase} empty="Nenhuma compra à vista nesta fatura." />
          </Panel>
          <Panel title="Parceladas" className="mt-4">
            <InvoiceLines lines={parceladas} today={today} custom={state.customCategories} onOpen={openPurchase} empty="Nenhuma parcela nesta fatura." />
          </Panel>
        </div>
      </div>

      {purchase !== null ? (
        <PurchaseDialog cardId={card.id} purchase={purchase === 'new' ? null : purchase} onClose={() => setPurchase(null)} />
      ) : null}
      {editingCard ? <CardDialog card={card} onClose={() => setEditingCard(false)} /> : null}
    </div>
  )
}

function InvoiceLines({
  lines,
  today,
  custom,
  onOpen,
  empty,
}: {
  lines: InvoiceLine[]
  today: Date
  custom: CustomCategory[]
  onOpen: (line: InvoiceLine) => void
  empty: string
}) {
  if (lines.length === 0) return <p className="text-sm text-ink-soft">{empty}</p>
  return (
    <ul className="divide-y divide-line">
      {lines.map((line) => (
        <li key={`${line.purchaseId}-${line.installment}`}>
          <button type="button" onClick={() => onOpen(line)} className="flex w-full items-center justify-between gap-3 py-3 text-left">
            <span>
              <span className="block text-sm font-medium">{line.description}</span>
              <span className="block text-xs text-ink-soft">
                {formatFriendly(line.date, today)} · {categoryLabel(line.category, custom)}
                {line.installments > 1 ? ` · parcela ${line.installment} de ${line.installments}` : ' · à vista'}
              </span>
            </span>
            <span className="tabular-nums">{formatBRL(line.amount)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function Chevron({ direction = 'left' }: { direction?: 'left' | 'right' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className={direction === 'right' ? 'rotate-180' : ''}>
      <path d="M10 3.5 5.5 8 10 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
