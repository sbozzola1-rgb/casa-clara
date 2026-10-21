import { useEffect, useId, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from 'react'
import { EMOJI_CHOICES, WEEKDAYS } from './model.ts'

let openModals = 0

export function DialogHeader({ title, description, onClose }: { title: string; description?: string; onClose: () => void }) {
  const titleId = useId()
  return (
    <header className="px-6 pt-6 pb-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id={titleId} className="font-display text-3xl">
            {title}
          </h2>
          {description ? <p className="mt-1 text-sm leading-relaxed text-[var(--soft)]">{description}</p> : null}
        </div>
        <button type="button" aria-label="Fechar" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-lg text-[var(--soft)]">
          ×
        </button>
      </div>
    </header>
  )
}

export function DialogBody({ children }: { children: ReactNode }) {
  return <div className="overflow-y-auto px-6 pb-2">{children}</div>
}

export function DialogFooter({ children }: { children: ReactNode }) {
  return <footer className="mt-2 flex flex-wrap justify-end gap-2 border-t border-[#f3e8ff] px-6 py-4">{children}</footer>
}

export function Modal({
  title,
  description,
  onClose,
  children,
  footer,
}: {
  title: string
  description?: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    openModals += 1
    const layer = openModals
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && layer === openModals) onClose()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      openModals -= 1
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  return (
    <div className="routine-root fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button type="button" className="absolute inset-0 bg-[#5b3a63]/35" aria-label="Fechar" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title} className="relative flex max-h-[min(92vh,820px)] w-full max-w-lg flex-col overflow-hidden rounded-[1.75rem] bg-[#fff7fb] shadow-2xl">
        <DialogHeader title={title} description={description} onClose={onClose} />
        <DialogBody>{children}</DialogBody>
        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </div>
    </div>
  )
}

export function FormModal({
  title,
  description,
  onClose,
  onSubmit,
  children,
  submitLabel = 'Salvar',
}: {
  title: string
  description?: string
  onClose: () => void
  onSubmit: (event: FormEvent) => void
  children: ReactNode
  submitLabel?: string
}) {
  const formId = useId()
  return (
    <Modal
      title={title}
      description={description}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" form={formId} className="btn-primary">
            {submitLabel}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} className="grid gap-4">
        {children}
      </form>
    </Modal>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-extrabold">
      {label}
      {children}
    </label>
  )
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`field-input ${props.className ?? ''}`} />
}

export function EmojiField({ value, onChange }: { value: string; onChange: (emoji: string) => void }) {
  return (
    <div>
      <p className="mb-2 text-sm font-extrabold">Ícone</p>
      <div className="flex flex-wrap gap-2">
        {EMOJI_CHOICES.map((emoji) => (
          <button key={emoji} type="button" className="choice text-xl" aria-pressed={value === emoji} onClick={() => onChange(emoji)}>
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}

export function DayField({ value, onChange }: { value: number[]; onChange: (days: number[]) => void }) {
  const toggle = (day: number) => {
    onChange(value.includes(day) ? value.filter((item) => item !== day) : [...value, day])
  }
  return (
    <div>
      <p className="mb-2 text-sm font-extrabold">Dias</p>
      <div className="flex flex-wrap gap-2">
        {WEEKDAYS.map((day) => (
          <button key={day.id} type="button" className="choice min-w-12" aria-pressed={value.includes(day.id)} onClick={() => toggle(day.id)}>
            {day.name}
          </button>
        ))}
      </div>
    </div>
  )
}

export function ToggleRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-3 text-left">
      <span>
        <span className="block font-extrabold">{label}</span>
        {hint ? <span className="mt-0.5 block text-sm font-semibold text-[var(--soft)]">{hint}</span> : null}
      </span>
      <span className={`relative h-7 w-12 shrink-0 rounded-full ${checked ? 'bg-gradient-to-r from-pink-400 to-violet-400' : 'bg-[#f3e8ff]'}`}>
        <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow ${checked ? 'left-5' : 'left-0.5'}`} />
      </span>
    </button>
  )
}

export function PinPad({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const press = (key: string) => {
    if (key === '⌫') onChange(value.slice(0, -1))
    else if (value.length < 4) onChange(value + key)
  }
  return (
    <div>
      <div className="flex justify-center gap-3" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <span key={index} className={`h-4 w-4 rounded-full ${index < value.length ? 'bg-fuchsia-400' : 'bg-fuchsia-100'}`} />
        ))}
      </div>
      <div className="mx-auto mt-6 grid max-w-xs grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((key) =>
          key ? (
            <button key={key} type="button" onClick={() => press(key)} className="font-display grid h-14 place-items-center rounded-2xl bg-white text-2xl shadow-sm">
              {key}
            </button>
          ) : (
            <span key="gap" />
          ),
        )}
      </div>
    </div>
  )
}

export function Burst({ token }: { token: number }) {
  if (!token) return null
  const colors = ['#f472b6', '#c084fc', '#f9a8d4', '#fde68a', '#a78bfa']
  return (
    <span className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {Array.from({ length: 12 }, (_, index) => (
        <i
          key={`${token}-${index}`}
          className="confetti"
          style={{
            ['--x' as string]: (index * 0.17) % 1,
            ['--y' as string]: (index * 0.29) % 1,
            ['--c' as string]: colors[index % colors.length],
          }}
        />
      ))}
    </span>
  )
}

export function EmptyState({ emoji, title, text, action }: { emoji: string; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="card px-6 py-10 text-center">
      <p className="text-5xl">{emoji}</p>
      <h2 className="font-display mt-3 text-3xl">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-[var(--soft)]">{text}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function ItemCard({
  emoji,
  title,
  meta,
  done,
  canToggle,
  onToggle,
  onEdit,
  onDelete,
  extra,
}: {
  emoji: string
  title: string
  meta?: string
  done?: boolean
  canToggle?: boolean
  onToggle?: () => void
  onEdit?: () => void
  onDelete?: () => void
  extra?: ReactNode
}) {
  const [burst, setBurst] = useState(0)
  return (
    <article className={`card relative flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center ${done ? 'opacity-90' : ''}`}>
      <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-[#fdf2f8] text-3xl ${burst ? 'check-pop' : ''}`}>{emoji}</span>
      <div className="min-w-0 flex-1">
        <h3 className={`font-display text-2xl leading-tight ${done ? 'line-through decoration-pink-300' : ''}`}>{title}</h3>
        {meta ? <p className="mt-1 text-sm font-bold text-[var(--soft)]">{meta}</p> : null}
        {extra}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
        {canToggle && onToggle ? (
          <button
            type="button"
            onClick={() => {
              if (!done) setBurst((value) => value + 1)
              onToggle()
            }}
            className={done ? 'btn-soft min-h-11 px-4 text-sm' : 'btn-primary min-h-11 px-4 text-sm'}
          >
            {done ? 'Prontinho' : 'Feito!'}
          </button>
        ) : null}
        {onEdit || onDelete ? (
          <div className="flex gap-1">
            {onEdit ? (
              <button type="button" onClick={onEdit} className="rounded-full px-3 py-1 text-sm font-extrabold text-[var(--soft)]">
                Editar
              </button>
            ) : null}
            {onDelete ? (
              <button type="button" onClick={onDelete} className="rounded-full px-3 py-1 text-sm font-extrabold text-rose-500">
                Apagar
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      {burst ? <Burst token={burst} /> : null}
    </article>
  )
}
