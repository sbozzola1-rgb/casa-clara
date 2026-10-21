import { useEffect, useId, type ReactNode } from 'react'

let openModals = 0

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
  const titleId = useId()

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
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button type="button" className="absolute inset-0 bg-night/60" aria-label="Fechar" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[min(92vh,760px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-card shadow-2xl"
      >
        <header className="px-6 pt-6 pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id={titleId} className="font-serif text-2xl tracking-tight">
                {title}
              </h2>
              {description ? <p className="mt-1 text-sm leading-relaxed text-ink-soft">{description}</p> : null}
            </div>
            <button
              type="button"
              aria-label="Fechar"
              onClick={onClose}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-paper"
            >
              <CloseIcon />
            </button>
          </div>
        </header>
        <div className="overflow-y-auto px-6 pb-2">{children}</div>
        {footer ? <footer className="mt-2 border-t border-line px-6 py-4">{footer}</footer> : null}
      </div>
    </div>
  )
}

export function ConfirmDialog({
  title,
  text,
  confirmLabel,
  onClose,
  onConfirm,
}: {
  title: string
  text: string
  confirmLabel: string
  onClose: () => void
  onConfirm: () => void
}) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" onClick={onClose} className="h-10 rounded-xl px-4 text-sm font-medium hover:bg-paper">
            Cancelar
          </button>
          <button type="button" onClick={onConfirm} className="h-10 rounded-xl bg-clay px-4 text-sm font-medium text-white">
            {confirmLabel}
          </button>
        </div>
      }
    >
      <p className="pb-2 text-sm leading-relaxed text-ink-soft">{text}</p>
    </Modal>
  )
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
