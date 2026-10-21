import { useRef } from 'react'
import { formatISO, monthKey, monthTitle, shiftMonth } from './lib/dates.ts'
import { attentionCount } from './lib/finance.ts'
import { CardDetail, CardsPage } from './pages/CardsPage.tsx'
import { CompanyPage } from './pages/CompanyPage.tsx'
import { Dashboard } from './pages/Dashboard.tsx'
import { FixedPage } from './pages/FixedPage.tsx'
import { GoalsPage } from './pages/GoalsPage.tsx'
import { OverduePage } from './pages/OverduePage.tsx'
import { FuelPage, GroceryPage, LeisurePage } from './pages/SpendingPages.tsx'
import { HouseGate } from './auth.tsx'
import { signOut } from './lib/cloud.ts'
import { StoreProvider, useStore, type Page } from './state.tsx'

const NAV: { id: Page['id']; label: string; icon: 'home' | 'late' | 'fixed' | 'card' | 'market' | 'leisure' | 'fuel' | 'company' | 'goal' }[] = [
  { id: 'dashboard', label: 'Início', icon: 'home' },
  { id: 'overdue', label: 'Vencidas', icon: 'late' },
  { id: 'fixed', label: 'Fixos', icon: 'fixed' },
  { id: 'cards', label: 'Cartões', icon: 'card' },
  { id: 'grocery', label: 'Mercado', icon: 'market' },
  { id: 'leisure', label: 'Lazer', icon: 'leisure' },
  { id: 'fuel', label: 'Combustível', icon: 'fuel' },
  { id: 'company', label: 'Empresa', icon: 'company' },
  { id: 'goals', label: 'Metas', icon: 'goal' },
]

export default function App() {
  return (
    <HouseGate>
      <StoreProvider>
        <Shell />
      </StoreProvider>
    </HouseGate>
  )
}

function Shell() {
  const { page, setPage, month, setMonth, today, toast, state, replaceState, notify } = useStore()
  const fileRef = useRef<HTMLInputElement>(null)
  const alerts = attentionCount(state, today)
  const currentMonth = monthKey(today)

  const go = (id: Page['id']) => {
    if (id === 'card') return
    setPage({ id })
  }

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

  return (
    <div className="min-h-screen bg-paper text-ink md:grid md:grid-cols-[240px_1fr]">
      <aside className="hidden md:flex md:flex-col md:bg-ink md:text-white">
        <div className="px-6 pt-7 pb-6">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10">
              <HomeIcon />
            </span>
            <span>
              <span className="block font-serif text-2xl leading-none">Casa Clara</span>
              <span className="mt-1 block text-xs text-white/55">Finanças da casa</span>
            </span>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {NAV.map((item) => {
            const active = page.id === item.id || (item.id === 'cards' && page.id === 'card')
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => go(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm ${active ? 'bg-white/12 text-white' : 'text-white/70 hover:bg-white/6 hover:text-white'}`}
              >
                <NavIcon name={item.icon} />
                <span className="flex-1">{item.label}</span>
                {item.id === 'overdue' && alerts > 0 ? (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-clay px-1 text-[11px] text-white">{alerts}</span>
                ) : null}
              </button>
            )
          })}
        </nav>
        <div className="px-6 py-5 text-xs leading-relaxed text-white/50">
          <p>A casa fica online. O que um lançar, o outro vê.</p>
          <div className="mt-3 flex gap-3">
            <button type="button" onClick={download} className="text-white/80 hover:text-white">
              Baixar cópia
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} className="text-white/80 hover:text-white">
              Restaurar
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-8">
            <p className="font-serif text-xl md:hidden">Casa Clara</p>
            <div className="flex items-center gap-1">
              <button type="button" aria-label="Mês anterior" onClick={() => setMonth(shiftMonth(month, -1))} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white">
                <Chevron />
              </button>
              <p className="min-w-40 text-center text-sm font-medium">{monthTitle(month)}</p>
              <button type="button" aria-label="Próximo mês" onClick={() => setMonth(shiftMonth(month, 1))} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white">
                <Chevron direction="right" />
              </button>
              {month !== currentMonth ? (
                <button type="button" onClick={() => setMonth(currentMonth)} className="ml-1 text-sm font-medium text-moss">
                  Hoje
                </button>
              ) : null}
            </div>
            <button type="button" onClick={() => void signOut()} className="text-sm font-medium text-ink-soft hover:text-ink">
              Sair
            </button>
          </div>
        </header>
        <main className="px-4 py-6 pb-28 md:px-8 md:pb-10">
          {page.id === 'dashboard' ? <Dashboard /> : null}
          {page.id === 'overdue' ? <OverduePage /> : null}
          {page.id === 'fixed' ? <FixedPage /> : null}
          {page.id === 'cards' ? <CardsPage /> : null}
          {page.id === 'card' ? <CardDetail key={page.cardId} cardId={page.cardId} /> : null}
          {page.id === 'grocery' ? <GroceryPage key={page.compose ? 'compose' : 'grocery'} /> : null}
          {page.id === 'leisure' ? <LeisurePage key={page.compose ? 'compose' : 'leisure'} /> : null}
          {page.id === 'fuel' ? <FuelPage key={page.compose ? 'compose' : 'fuel'} /> : null}
          {page.id === 'company' ? <CompanyPage /> : null}
          {page.id === 'goals' ? <GoalsPage /> : null}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex gap-1 overflow-x-auto border-t border-line bg-card/95 px-2 py-1 backdrop-blur md:hidden">
        {NAV.map((item) => {
          const active = page.id === item.id || (item.id === 'cards' && page.id === 'card')
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => go(item.id)}
              className={`flex min-w-[4.25rem] shrink-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] ${active ? 'text-moss' : 'text-ink-soft'}`}
            >
              <span className="relative">
                <NavIcon name={item.icon} />
                {item.id === 'overdue' && alerts > 0 ? <span className="absolute -top-1 -right-2 h-2 w-2 rounded-full bg-clay" /> : null}
              </span>
              {item.label}
            </button>
          )
        })}
      </nav>

      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (!file) return
          void file
            .text()
            .then((text) => replaceState(JSON.parse(text)))
            .catch(() => notify('Não foi possível ler o arquivo'))
            .finally(() => {
              event.target.value = ''
            })
        }}
      />

      {toast ? (
        <div role="status" className="fixed top-20 left-1/2 z-[70] -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  )
}

function Chevron({ direction = 'left' }: { direction?: 'left' | 'right' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true" className={direction === 'right' ? 'rotate-180' : ''}>
      <path d="M10 3.5 5.5 8 10 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function NavIcon({ name }: { name: (typeof NAV)[number]['icon'] }) {
  if (name === 'home') return <HomeIcon />
  if (name === 'late') return <Icon path="M10 3.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM10 6.5V10l2.2 1.4" />
  if (name === 'fixed') return <Icon path="M3 6.5h14M3 10h14M3 13.5h10" />
  if (name === 'card') return <Icon path="M3 6.5h14v8H3v-8Zm0 3h14" />
  if (name === 'market') return <Icon path="M4 8h12l-1 7H5L4 8Zm2-2.5a4 4 0 0 1 8 0" />
  if (name === 'leisure') return <Icon path="M4 13.5 8 4l2 5 2-2 4 6.5" />
  if (name === 'fuel') return <Icon path="M7 16.5V6.5h5v10M9 6.5V4.5h1.5M12 9h2.2a1.5 1.5 0 0 1 0 3H12" />
  if (name === 'company') return <Icon path="M4 16.5h12M6.5 16.5V5.5h7v11M8.2 8h1.2M10.6 8h1.2M8.2 10.5h1.2M10.6 10.5h1.2" />
  return <Icon path="M10 3.5v13M6 7.5h5.5a2.5 2.5 0 0 1 0 5H6" />
}

function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M3 8.2 9 3.5l6 4.7V15H3V8.2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

function Icon({ path }: { path: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d={path} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
