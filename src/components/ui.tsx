import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { formatBRL, round2 } from '../lib/money.ts'

export const fieldClass =
  'w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm text-ink outline-none transition placeholder:text-ink/30 focus:border-moss focus:ring-2 focus:ring-moss/20'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}

export function Button({ variant = 'primary', className = '', type = 'button', ...props }: ButtonProps) {
  const styles = {
    primary: 'bg-moss text-white hover:bg-moss-deep',
    secondary: 'bg-ink text-white hover:bg-[#243044]',
    ghost: 'text-ink hover:bg-[#efe9dc]',
    danger: 'text-clay hover:bg-[#f8e6e3]',
  }
  return (
    <button
      type={type}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...props}
    />
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs leading-relaxed text-ink-soft">{hint}</span> : null}
    </label>
  )
}

export function MoneyField({
  label,
  value,
  onChange,
  hint,
  autoFocus = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  hint?: string
  autoFocus?: boolean
}) {
  return (
    <Field label={label} hint={hint}>
      <span className="relative block">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink/45">R$</span>
        <input
          autoFocus={autoFocus}
          inputMode="decimal"
          className={`${fieldClass} pl-10`}
          placeholder="0,00"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
    </Field>
  )
}

export function PageIntro({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow ? <p className="text-xs font-semibold tracking-[0.16em] text-moss uppercase">{eyebrow}</p> : null}
        <h1 className="mt-1 font-serif text-4xl tracking-tight text-ink">{title}</h1>
        {description ? <p className="mt-2 text-sm leading-relaxed text-ink-soft">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function Panel({
  title,
  action,
  children,
  className = '',
}: {
  title?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-2xl border border-line bg-card p-5 ${className}`}>
      {title ? (
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="font-serif text-2xl tracking-tight">{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#d9d0c0] bg-card px-6 py-12 text-center">
      <h2 className="font-serif text-3xl tracking-tight">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">{text}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  )
}

export function BudgetMeter({ spent, goal }: { spent: number; goal: number | null }) {
  if (goal == null) {
    return <p className="text-sm leading-relaxed text-ink-soft">A meta ainda não foi definida.</p>
  }
  const over = spent > goal + 0.001
  const ratio = goal <= 0 ? (spent > 0 ? 1 : 0) : Math.min(spent / goal, 1)
  const left = round2(goal - spent)
  const tone = over ? 'bg-clay' : ratio >= 0.8 ? 'bg-amber' : 'bg-moss'
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-serif text-4xl tracking-tight tabular-nums">{formatBRL(spent)}</p>
        <p className="text-sm text-ink-soft">de {formatBRL(goal)}</p>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-[#e7e1d4]">
        <div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${Math.max(ratio * 100, spent > 0 ? 3 : 0)}%` }} />
      </div>
      <p className={`mt-2 text-sm font-medium ${over ? 'text-clay' : 'text-moss'}`}>
        {over ? `Passou ${formatBRL(Math.abs(left))} da meta` : `Ainda pode gastar ${formatBRL(left)}`}
      </p>
    </div>
  )
}

export function CompareBars({ items }: { items: { key: string; label: string; spent: number; goal: number | null }[] }) {
  const peak = Math.max(1, ...items.flatMap((item) => [item.spent, item.goal ?? 0]))
  return (
    <div>
      <div className="flex h-36 items-end gap-2">
        {items.map((item) => {
          const spentHeight = (item.spent / peak) * 100
          const goalHeight = item.goal == null ? null : (item.goal / peak) * 100
          const over = item.goal != null && item.spent > item.goal
          return (
            <div key={item.key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <div className="relative h-28 w-full rounded-md bg-[#f6f1e7]">
                <div
                  className={`absolute right-1 bottom-1 left-1 rounded-sm ${over ? 'bg-clay' : 'bg-moss'}`}
                  style={{ height: `${spentHeight}%`, minHeight: item.spent > 0 ? 4 : 0 }}
                />
                {goalHeight != null ? (
                  <div className="absolute right-0.5 left-0.5 border-t border-dashed border-ink/60" style={{ bottom: `calc(${goalHeight}% + 4px)` }} />
                ) : null}
              </div>
              <span className="w-full truncate text-center text-[11px] text-ink-soft">{item.label}</span>
            </div>
          )
        })}
      </div>
      <p className="mt-2 text-xs text-ink-soft">A linha tracejada é a meta. A barra é o que foi gasto.</p>
    </div>
  )
}

export function FlowChart({ items }: { items: { key: string; label: string; income: number; expense: number }[] }) {
  const peak = Math.max(1, ...items.flatMap((item) => [item.income, item.expense]))
  const hasAny = items.some((item) => item.income > 0 || item.expense > 0)
  if (!hasAny) {
    return <p className="text-sm text-ink-soft">O gráfico aparece quando houver entrada ou saída no período.</p>
  }
  return (
    <div>
      <div className="mb-4 flex gap-4 text-xs font-medium text-ink-soft">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-moss" /> Entradas
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-clay" /> Saídas
        </span>
      </div>
      <div className="flex items-end gap-2">
        {items.map((item) => (
          <div key={item.key} className="flex min-w-0 flex-1 flex-col items-center gap-2" title={`Entradas ${formatBRL(item.income)} · saídas ${formatBRL(item.expense)}`}>
            <div className="flex h-32 w-full items-end justify-center gap-1">
              <div className="w-3 rounded-t bg-moss sm:w-4" style={{ height: `${(item.income / peak) * 100}%`, minHeight: item.income > 0 ? 4 : 0 }} />
              <div className="w-3 rounded-t bg-clay sm:w-4" style={{ height: `${(item.expense / peak) * 100}%`, minHeight: item.expense > 0 ? 4 : 0 }} />
            </div>
            <span className="w-full truncate text-center text-[11px] text-ink-soft">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ToneBadge({ tone, children }: { tone: 'paid' | 'overdue' | 'soon' | 'open'; children: ReactNode }) {
  const styles = {
    paid: 'bg-[#e5f2eb] text-moss',
    overdue: 'bg-[#f8e6e3] text-clay',
    soon: 'bg-[#f8ecd9] text-amber',
    open: 'bg-[#efe9dc] text-ink-soft',
  }
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles[tone]}`}>{children}</span>
}

export function toneLabel(tone: 'paid' | 'overdue' | 'soon' | 'open'): string {
  if (tone === 'paid') return 'Pago'
  if (tone === 'overdue') return 'Atrasado'
  if (tone === 'soon') return 'Vence já'
  return 'Em aberto'
}
