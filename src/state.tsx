import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { pullHousehold, pushHousehold, subscribeHousehold } from './lib/cloud.ts'
import { monthKey } from './lib/dates.ts'
import { loadState, sanitize, saveState } from './lib/storage.ts'
import { emptyState, type AppState, type CashExpense, type CompanyEntry, type CreditCard, type FixedExpense, type IncomeSource, type Purchase, type SpendEntry } from './lib/types.ts'

export type Page =
  | { id: 'dashboard' }
  | { id: 'fixed' }
  | { id: 'cards' }
  | { id: 'card'; cardId: string }
  | { id: 'grocery'; compose?: boolean }
  | { id: 'leisure'; compose?: boolean }
  | { id: 'overdue' }
  | { id: 'company' }
  | { id: 'goals' }

interface Store {
  state: AppState
  month: string
  today: Date
  page: Page
  toast: string | null
  setMonth: (month: string) => void
  setPage: (page: Page) => void
  notify: (message: string) => void
  upsertIncome: (source: IncomeSource) => void
  removeIncome: (id: string) => void
  upsertCompany: (entry: CompanyEntry) => void
  removeCompany: (id: string) => void
  upsertFixed: (expense: FixedExpense) => void
  removeFixed: (id: string) => void
  toggleFixedPaid: (id: string, month: string) => void
  upsertCard: (card: CreditCard) => void
  removeCard: (id: string) => void
  toggleInvoicePaid: (cardId: string, year: number, monthIndex: number) => void
  upsertPurchase: (purchase: Purchase) => void
  removePurchase: (id: string) => void
  saveSpend: (previous: SpendEntry | null, next: { kind: 'card'; purchase: Purchase } | { kind: 'cash'; expense: CashExpense }) => void
  removeSpend: (entry: SpendEntry) => void
  setLeisureWeekly: (value: number | null) => void
  setGroceryDefault: (value: number | null) => void
  setGroceryMonth: (month: string, value: number | null) => void
  replaceState: (input: unknown) => void
}

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => emptyState())
  const [ready, setReady] = useState(false)
  const [month, setMonth] = useState(() => monthKey(new Date()))
  const [page, setPage] = useState<Page>({ id: 'dashboard' })
  const [toast, setToast] = useState<string | null>(null)
  const [today] = useState(() => new Date())
  const revision = useRef(0)
  const ignorePush = useRef(true)

  useEffect(() => {
    let cancel = false
    void (async () => {
      const local = loadState()
      try {
        const remote = await pullHousehold()
        if (cancel) return
        const clean = remote ? sanitize(remote.data) : null
        if (remote && clean) {
          revision.current = remote.revision
          ignorePush.current = true
          setState(clean)
        } else {
          ignorePush.current = false
          revision.current = 0
          setState(local)
        }
      } catch {
        if (cancel) return
        ignorePush.current = true
        setState(local)
        setToast('Sem conexão. Mostrando a última cópia deste aparelho.')
      } finally {
        if (!cancel) setReady(true)
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    return subscribeHousehold((row) => {
      if (row.revision <= revision.current) return
      const clean = sanitize(row.data)
      if (!clean) return
      revision.current = row.revision
      ignorePush.current = true
      setState(clean)
    })
  }, [ready])

  const sending = useRef(false)
  const pending = useRef<AppState | null>(null)

  useEffect(() => {
    if (!ready) return
    saveState(state)
    if (ignorePush.current) {
      ignorePush.current = false
      return
    }
    pending.current = state
    const timer = window.setTimeout(() => {
      const flush = () => {
        const snapshot = pending.current
        if (!snapshot || sending.current) return
        pending.current = null
        sending.current = true
        const nextRevision = revision.current + 1
        void pushHousehold(snapshot, nextRevision)
          .then(() => {
            revision.current = Math.max(revision.current, nextRevision)
          })
          .catch(() => {
            setToast('Não consegui salvar online. Tente de novo.')
          })
          .finally(() => {
            sending.current = false
            flush()
          })
      }
      flush()
    }, 400)
    return () => window.clearTimeout(timer)
  }, [state, ready])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  const notify = (message: string) => setToast(message)

  const value = useMemo<Store>(() => {
    return {
      state,
      month,
      today,
      page,
      toast,
      setMonth,
      setPage,
      notify,
      upsertIncome: (source) => {
        setState((current) => ({
          ...current,
          incomes: current.incomes.some((item) => item.id === source.id)
            ? current.incomes.map((item) => (item.id === source.id ? source : item))
            : [...current.incomes, source],
        }))
        notify('Renda atualizada')
      },
      removeIncome: (id) => {
        setState((current) => ({ ...current, incomes: current.incomes.filter((item) => item.id !== id) }))
        notify('Renda removida')
      },
      upsertCompany: (entry) => {
        setState((current) => ({
          ...current,
          companyEntries: current.companyEntries.some((item) => item.id === entry.id)
            ? current.companyEntries.map((item) => (item.id === entry.id ? entry : item))
            : [...current.companyEntries, entry],
        }))
        notify('Movimento da empresa salvo')
      },
      removeCompany: (id) => {
        setState((current) => ({ ...current, companyEntries: current.companyEntries.filter((item) => item.id !== id) }))
        notify('Movimento da empresa removido')
      },
      upsertFixed: (expense) => {
        setState((current) => ({
          ...current,
          fixedExpenses: current.fixedExpenses.some((item) => item.id === expense.id)
            ? current.fixedExpenses.map((item) => (item.id === expense.id ? expense : item))
            : [...current.fixedExpenses, expense],
        }))
        notify('Gasto fixo salvo')
      },
      removeFixed: (id) => {
        setState((current) => ({
          ...current,
          fixedExpenses: current.fixedExpenses.filter((item) => item.id !== id),
          paidFixed: Object.fromEntries(Object.entries(current.paidFixed).filter(([key]) => !key.startsWith(`${id}:`))),
        }))
        notify('Gasto fixo removido')
      },
      toggleFixedPaid: (id, targetMonth) => {
        const key = `${id}:${targetMonth}`
        setState((current) => {
          const paidFixed = { ...current.paidFixed }
          if (paidFixed[key]) delete paidFixed[key]
          else paidFixed[key] = true
          return { ...current, paidFixed }
        })
      },
      upsertCard: (card) => {
        setState((current) => ({
          ...current,
          cards: current.cards.some((item) => item.id === card.id)
            ? current.cards.map((item) => (item.id === card.id ? card : item))
            : [...current.cards, card],
        }))
        notify('Cartão salvo')
      },
      removeCard: (id) => {
        setState((current) => ({
          ...current,
          cards: current.cards.filter((item) => item.id !== id),
          purchases: current.purchases.filter((item) => item.cardId !== id),
          paidInvoices: Object.fromEntries(Object.entries(current.paidInvoices).filter(([key]) => !key.startsWith(`${id}:`))),
        }))
        notify('Cartão removido')
      },
      toggleInvoicePaid: (cardId, year, monthIndex) => {
        const key = `${cardId}:${year}-${String(monthIndex + 1).padStart(2, '0')}`
        setState((current) => {
          const paidInvoices = { ...current.paidInvoices }
          if (paidInvoices[key]) delete paidInvoices[key]
          else paidInvoices[key] = true
          return { ...current, paidInvoices }
        })
      },
      upsertPurchase: (purchase) => {
        setState((current) => ({
          ...current,
          purchases: current.purchases.some((item) => item.id === purchase.id)
            ? current.purchases.map((item) => (item.id === purchase.id ? purchase : item))
            : [...current.purchases, purchase],
        }))
        notify('Compra salva')
      },
      removePurchase: (id) => {
        setState((current) => ({
          ...current,
          purchases: current.purchases.filter((item) => item.id !== id),
        }))
        notify('Compra removida')
      },
      saveSpend: (previous, next) => {
        setState((current) => {
          let purchases = current.purchases
          let cashExpenses = current.cashExpenses
          if (previous?.source === 'card') purchases = purchases.filter((item) => item.id !== previous.id)
          if (previous?.source === 'cash') cashExpenses = cashExpenses.filter((item) => item.id !== previous.id)
          if (next.kind === 'card') {
            purchases = [...purchases.filter((item) => item.id !== next.purchase.id), next.purchase]
          } else {
            cashExpenses = [...cashExpenses.filter((item) => item.id !== next.expense.id), next.expense]
          }
          return { ...current, purchases, cashExpenses }
        })
        notify('Lançamento salvo')
      },
      removeSpend: (entry) => {
        setState((current) => ({
          ...current,
          purchases: entry.source === 'card' ? current.purchases.filter((item) => item.id !== entry.id) : current.purchases,
          cashExpenses: entry.source === 'cash' ? current.cashExpenses.filter((item) => item.id !== entry.id) : current.cashExpenses,
        }))
        notify('Lançamento removido')
      },
      setLeisureWeekly: (leisureWeeklyMax) => {
        setState((current) => ({ ...current, goals: { ...current.goals, leisureWeeklyMax } }))
        notify('Teto de lazer atualizado')
      },
      setGroceryDefault: (groceryMonthlyDefault) => {
        setState((current) => ({ ...current, goals: { ...current.goals, groceryMonthlyDefault } }))
        notify('Meta padrão de mercado atualizada')
      },
      setGroceryMonth: (targetMonth, value) => {
        setState((current) => {
          const groceryByMonth = { ...current.goals.groceryByMonth }
          if (value == null) delete groceryByMonth[targetMonth]
          else groceryByMonth[targetMonth] = value
          return { ...current, goals: { ...current.goals, groceryByMonth } }
        })
        notify(value == null ? 'Mês voltou para a meta padrão' : 'Meta do mês ajustada')
      },
      replaceState: (next: unknown) => {
        const clean = sanitize(next)
        if (!clean) {
          notify('Não foi possível ler essa cópia')
          return
        }
        setState(clean)
        notify('Cópia restaurada')
      },
    }
  }, [state, month, today, page, toast])

  return (
    <StoreContext.Provider value={value}>
      {ready ? children : <p className="grid min-h-screen place-items-center bg-paper px-6 text-sm text-ink-soft">Abrindo a casa…</p>}
    </StoreContext.Provider>
  )
}

export function useStore(): Store {
  const store = useContext(StoreContext)
  if (!store) throw new Error('Store ausente')
  return store
}
