import { useEffect, useState } from 'react'

const NAME = 'Finanças do Casal Carioca'

export function CoupleMark({ tone = 'ink', size = 'regular' }: { tone?: 'ink' | 'light'; size?: 'hero' | 'regular' | 'compact' }) {
  const photo = size === 'hero' ? 'h-36 w-36' : size === 'compact' ? 'h-20 w-20' : 'h-28 w-28'
  const stacked = size !== 'compact'
  const type = size === 'hero' ? 'text-2xl' : size === 'compact' ? 'text-lg' : 'text-3xl tracking-tight'
  return (
    <div className={stacked ? 'flex flex-col items-start gap-3' : 'flex min-w-0 items-center gap-3'}>
      <img
        src={`${import.meta.env.BASE_URL}casal-carioca.jpg`}
        alt=""
        className={`${photo} shrink-0 rounded-full object-cover ${tone === 'light' ? 'ring-2 ring-white/40' : 'ring-2 ring-line'}`}
      />
      <span className={`font-serif leading-tight ${type}`}>{NAME}</span>
    </div>
  )
}

export function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    const sync = () => setDark(document.documentElement.classList.contains('dark'))
    window.addEventListener('casa-theme', sync)
    return () => window.removeEventListener('casa-theme', sync)
  }, [])

  const toggle = () => {
    const next = !document.documentElement.classList.contains('dark')
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('casa-clara.theme', next ? 'dark' : 'light')
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next ? '#10161f' : '#f3efe6')
    setDark(next)
  }

  return (
    <button
      type="button"
      aria-label={dark ? 'Usar tema claro' : 'Usar tema escuro'}
      aria-pressed={dark}
      onClick={toggle}
      className="grid h-9 w-9 place-items-center rounded-full text-ink-soft hover:bg-card hover:text-ink"
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M14.5 11.2A6.2 6.2 0 0 1 6.8 3.5 6.4 6.4 0 1 0 14.5 11.2Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <circle cx="9" cy="9" r="3.1" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 2.2v1.6M9 14.2v1.6M2.2 9h1.6M14.2 9h1.6M4.2 4.2l1.1 1.1M12.7 12.7l1.1 1.1M13.8 4.2l-1.1 1.1M5.3 12.7l-1.1 1.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
