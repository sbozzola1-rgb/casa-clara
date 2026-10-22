import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { pullHousehold, pushHousehold, subscribeHousehold } from './lib/cloud.ts'
import { uid } from './lib/money.ts'
import { dateOn, formatISO, monthKey, parseMonthKey } from './lib/dates.ts'
import { additionalKey, fixedCardPurchaseId, fixedKey, fixedPaymentFromPurchase } from './lib/finance.ts'
import { loadState, sanitize, saveState } from './lib/storage.ts'
import { emptyState, SPEND_CATEGORIES, type AdditionalExpense, type AppState, type CashExpense, type CompanyEntry, type CreditCard, type FixedExpense, type GroceryInflow, type HouseTask, type IncomeSource, type LeisurePlan, type Purchase, type SavingPot, type SpendEntry } from './lib/types.ts'

export type Page =
  | { id: 'dashboard' }
  | { id: 'fixed' }
  | { id: 'additional' }
  | { id: 'cards' }
  | { id: 'card'; cardId: string; dueMonth?: string }
  | { id: 'grocery'; compose?: boolean }
  | { id: 'leisure'; compose?: boolean }
  | { id: 'fuel'; compose?: boolean }
  | { id: 'overdue' }
  | { id: 'company' }
  | { id: 'goals' }
  | { id: 'savings' }
  | { id: 'plans' }
  | { id: 'todo' }

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
  payFixed: (id: string, month: string, cardId: string | null) => void
  unpayFixed: (id: string, month: string) => void
  upsertAdditional: (expense: AdditionalExpense) => void
  removeAdditional: (id: string) => void
  setAdditionalPaid: (id: string, month: string, paid: boolean) => void
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
  setFuelDefault: (value: number | null) => void
  setFuelMonth: (month: string, value: number | null) => void
  upsertGroceryInflow: (entry: GroceryInflow) => void
  removeGroceryInflow: (id: string) => void
  addCustomCategory: (name: string) => string
  removeCustomCategory: (id: string) => void
  upsertSaving: (pot: SavingPot) => void
  removeSaving: (id: string) => void
  upsertPlan: (plan: LeisurePlan) => void
  removePlan: (id: string) => void
  upsertTask: (task: HouseTask) => void
  removeTask: (id: string) => void
  setTaskDone: (id: string, done: boolean) => void
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
          purchases: current.purchases.map((item) => {
            const payment = fixedPaymentFromPurchase(item.id)
            if (!payment || payment.expenseId !== expense.id) return item
            const { year, monthIndex } = parseMonthKey(payment.month)
            return {
              ...item,
              description: expense.name,
              amount: expense.amount,
              date: formatISO(dateOn(year, monthIndex, expense.dueDay)),
            }
          }),
        }))
        notify('Gasto fixo salvo')
      },
      removeFixed: (id) => {
        setState((current) => ({
          ...current,
          fixedExpenses: current.fixedExpenses.filter((item) => item.id !== id),
          paidFixed: Object.fromEntries(Object.entries(current.paidFixed).filter(([key]) => !key.startsWith(`${id}:`))),
          purchases: current.purchases.filter((item) => fixedPaymentFromPurchase(item.id)?.expenseId !== id),
        }))
        notify('Gasto fixo removido')
      },
      payFixed: (id, targetMonth, cardId) => {
        setState((current) => {
          const expense = current.fixedExpenses.find((item) => item.id === id)
          if (!expense) return current
          const purchaseId = fixedCardPurchaseId(id, targetMonth)
          const paidFixed = { ...current.paidFixed, [fixedKey(id, targetMonth)]: true as const }
          const without = current.purchases.filter((item) => item.id !== purchaseId)
          if (!cardId) return { ...current, paidFixed, purchases: without }
          const { year, monthIndex } = parseMonthKey(targetMonth)
          const purchase: Purchase = {
            id: purchaseId,
            cardId,
            description: expense.name,
            amount: expense.amount,
            installments: 1,
            date: formatISO(dateOn(year, monthIndex, expense.dueDay)),
            category: 'outro',
          }
          return { ...current, paidFixed, purchases: [...without, purchase] }
        })
      },
      unpayFixed: (id, targetMonth) => {
        setState((current) => {
          const paidFixed = { ...current.paidFixed }
          delete paidFixed[fixedKey(id, targetMonth)]
          return {
            ...current,
            paidFixed,
            purchases: current.purchases.filter((item) => item.id !== fixedCardPurchaseId(id, targetMonth)),
          }
        })
      },
      upsertAdditional: (expense) => {
        setState((current) => {
          const list = current.additionalExpenses ?? []
          return {
            ...current,
            additionalExpenses: list.some((item) => item.id === expense.id)
              ? list.map((item) => (item.id === expense.id ? expense : item))
              : [...list, expense],
          }
        })
        notify('Gasto adicional salvo')
      },
      removeAdditional: (id) => {
        setState((current) => ({
          ...current,
          additionalExpenses: (current.additionalExpenses ?? []).filter((item) => item.id !== id),
          paidAdditional: Object.fromEntries(Object.entries(current.paidAdditional ?? {}).filter(([key]) => !key.startsWith(`${id}:`))),
        }))
        notify('Gasto adicional removido')
      },
      setAdditionalPaid: (id, targetMonth, paid) => {
        setState((current) => {
          const paidAdditional = { ...(current.paidAdditional ?? {}) }
          const key = additionalKey(id, targetMonth)
          if (paid) paidAdditional[key] = true
          else delete paidAdditional[key]
          return { ...current, paidAdditional }
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
        setState((current) => {
          const payment = fixedPaymentFromPurchase(id)
          const paidFixed = { ...current.paidFixed }
          if (payment) delete paidFixed[fixedKey(payment.expenseId, payment.month)]
          return {
            ...current,
            paidFixed,
            purchases: current.purchases.filter((item) => item.id !== id),
          }
        })
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
      setFuelDefault: (fuelMonthlyDefault) => {
        setState((current) => ({ ...current, goals: { ...current.goals, fuelMonthlyDefault } }))
        notify('Meta padrão de combustível atualizada')
      },
      setFuelMonth: (targetMonth, value) => {
        setState((current) => {
          const fuelByMonth = { ...current.goals.fuelByMonth }
          if (value == null) delete fuelByMonth[targetMonth]
          else fuelByMonth[targetMonth] = value
          return { ...current, goals: { ...current.goals, fuelByMonth } }
        })
        notify(value == null ? 'Mês voltou para a meta padrão' : 'Meta de combustível ajustada')
      },
      upsertGroceryInflow: (entry) => {
        setState((current) => ({
          ...current,
          groceryInflows: current.groceryInflows.some((item) => item.id === entry.id)
            ? current.groceryInflows.map((item) => (item.id === entry.id ? entry : item))
            : [...current.groceryInflows, entry],
        }))
        notify('Entrada do mercado salva')
      },
      removeGroceryInflow: (id) => {
        setState((current) => ({ ...current, groceryInflows: current.groceryInflows.filter((item) => item.id !== id) }))
        notify('Entrada do mercado removida')
      },
      addCustomCategory: (name) => {
        const trimmed = name.trim()
        if (!trimmed) return ''
        const builtin = SPEND_CATEGORIES.find((item) => item.label.toLowerCase() === trimmed.toLowerCase())
        if (builtin) return builtin.id
        const existing = (state.customCategories ?? []).find((item) => item.name.toLowerCase() === trimmed.toLowerCase())
        if (existing) return existing.id
        const id = uid()
        setState((current) => ({
          ...current,
          customCategories: [...(current.customCategories ?? []), { id, name: trimmed }],
        }))
        notify('Categoria salva')
        return id
      },
      removeCustomCategory: (id) => {
        setState((current) => ({
          ...current,
          customCategories: (current.customCategories ?? []).filter((item) => item.id !== id),
          purchases: current.purchases.map((item) => (item.category === id ? { ...item, category: 'outro' } : item)),
        }))
        notify('Categoria removida')
      },
      upsertSaving: (pot) => {
        setState((current) => ({
          ...current,
          savings: current.savings.some((item) => item.id === pot.id)
            ? current.savings.map((item) => (item.id === pot.id ? pot : item))
            : [...current.savings, pot],
        }))
        notify('Economia salva')
      },
      removeSaving: (id) => {
        setState((current) => ({ ...current, savings: current.savings.filter((item) => item.id !== id) }))
        notify('Economia removida')
      },
      upsertPlan: (plan) => {
        setState((current) => ({
          ...current,
          leisurePlans: current.leisurePlans.some((item) => item.id === plan.id)
            ? current.leisurePlans.map((item) => (item.id === plan.id ? plan : item))
            : [...current.leisurePlans, plan],
        }))
        notify('Plano de lazer salvo')
      },
      removePlan: (id) => {
        setState((current) => ({ ...current, leisurePlans: current.leisurePlans.filter((item) => item.id !== id) }))
        notify('Plano de lazer removido')
      },
      upsertTask: (task) => {
        setState((current) => ({
          ...current,
          tasks: current.tasks.some((item) => item.id === task.id)
            ? current.tasks.map((item) => (item.id === task.id ? task : item))
            : [...current.tasks, task],
        }))
        notify('Tarefa salva')
      },
      removeTask: (id) => {
        setState((current) => ({ ...current, tasks: current.tasks.filter((item) => item.id !== id) }))
        notify('Tarefa removida')
      },
      setTaskDone: (id, done) => {
        setState((current) => ({
          ...current,
          tasks: current.tasks.map((item) => (item.id === id ? { ...item, done } : item)),
        }))
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
