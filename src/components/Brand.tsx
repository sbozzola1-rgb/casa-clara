export function CoupleMark({ tone = 'ink', size = 'regular' }: { tone?: 'ink' | 'light'; size?: 'regular' | 'compact' }) {
  const compact = size === 'compact'
  return (
    <div className="flex min-w-0 items-center gap-3">
      <img
        src={`${import.meta.env.BASE_URL}casal-carioca.jpg`}
        alt=""
        className={`${compact ? 'h-9 w-9' : 'h-12 w-12'} shrink-0 rounded-full object-cover ${tone === 'light' ? 'ring-2 ring-white/30' : 'ring-2 ring-line'}`}
      />
      <span className={`font-serif leading-tight ${compact ? 'text-sm' : tone === 'light' ? 'text-lg' : 'text-3xl tracking-tight'}`}>
        Finanças do casal carioca
      </span>
    </div>
  )
}
