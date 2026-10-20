import type { ReactNode } from 'react'
import type { FixedIconId } from '../lib/types.ts'

export function ExpenseIcon({ name }: { name: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {iconShape(name)}
    </svg>
  )
}

export function ExpenseMark({ name }: { name: string }) {
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e5f2eb] text-moss">
      <ExpenseIcon name={name} />
    </span>
  )
}

function iconShape(name: string): ReactNode {
  const common = { stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  const id = (['casa', 'predio', 'raio', 'gota', 'chama', 'wifi', 'telefone', 'escola', 'saude', 'carro', 'assinatura', 'outro'] as const).includes(name as FixedIconId)
    ? (name as FixedIconId)
    : 'outro'
  if (id === 'casa') {
    return (
      <>
        <path d="M4 11.2 12 4.2l8 7" {...common} />
        <path d="M7 10.8V20h10v-9.2" {...common} />
      </>
    )
  }
  if (id === 'predio') {
    return (
      <>
        <path d="M5 20V6h14v14" {...common} />
        <path d="M3.5 20h17" {...common} />
        <path d="M8.5 9h2M13.5 9h2M8.5 13h2M13.5 13h2" {...common} />
      </>
    )
  }
  if (id === 'raio') return <path d="M13 3 6 13h5l-1 8 8-11h-5l0-7Z" {...common} />
  if (id === 'gota') return <path d="M12 3.2S18 9.2 18 13.4a6 6 0 0 1-12 0C6 9.2 12 3.2 12 3.2Z" {...common} />
  if (id === 'chama') return <path d="M12 21c3.6-1.8 5.2-4.8 4-8-.8 1.4-2.2 1.8-2.4.2.6-2.6-.8-4.8-2.6-6.6-1 2.2-.4 4-1.8 5.4C7.6 13.6 7.2 16.4 8.4 18.4 9.4 20 10.6 21 12 21Z" {...common} />
  if (id === 'wifi') {
    return (
      <>
        <path d="M5 10.5a10 10 0 0 1 14 0" {...common} />
        <path d="M8 13.6a6 6 0 0 1 8 0" {...common} />
        <path d="M12 17.2h.01" {...common} />
      </>
    )
  }
  if (id === 'telefone') {
    return (
      <>
        <rect x="7" y="3" width="10" height="18" rx="2" {...common} />
        <path d="M11 18h2" {...common} />
      </>
    )
  }
  if (id === 'escola') {
    return (
      <>
        <path d="M3 10 12 5l9 5-9 5-9-5Z" {...common} />
        <path d="M7 12.2V17c1.6 1.3 3.2 2 5 2s3.4-.7 5-2v-4.8" {...common} />
      </>
    )
  }
  if (id === 'saude') return <path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5V4Z" {...common} />
  if (id === 'carro') {
    return (
      <>
        <path d="M4 15h16v3H4v-3Z" {...common} />
        <path d="M6 15 8.2 9h7.6L18 15" {...common} />
        <path d="M7.5 18.2h.01M16.5 18.2h.01" {...common} />
      </>
    )
  }
  if (id === 'assinatura') {
    return (
      <>
        <rect x="4" y="6" width="16" height="12" rx="2" {...common} />
        <path d="m10 9.5 5 2.5-5 2.5v-5Z" {...common} />
      </>
    )
  }
  return (
    <>
      <circle cx="12" cy="12" r="8" {...common} />
      <path d="M12 8v8M8 12h8" {...common} />
    </>
  )
}
