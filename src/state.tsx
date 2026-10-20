import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { monthKey } from './lib/dates.ts'
import { loadState, sanitize, saveState } from './lib/storage.ts'
import type { AppState, CashExpense, CompanyEntry, CreditCard, FixedExpense, IncomeSource, Purchase, SpendEntry } from './lib/types.ts'

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
  const [state, setState] = useState<AppState>(() => loadState())
  const [month, setMonth] = useState(() => monthKey(new Date()))
  const [page, setPage] = useState<Page>({ id: 'dashboard' })
  const [toast, setToast] = useState<string | null>(null)
  const [today] = useState(() => new Date())

  useEffect(() => {
    saveState(state)
  }, [state])

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

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const store = useContext(StoreContext)
  if (!store) throw new Error('Store ausente')
  return store
}
