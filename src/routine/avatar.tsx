import type { ReactNode } from 'react'
import type { AvatarLook } from './model.ts'

const HAIRS = [
  { id: 'bone', label: 'Boné' },
  { id: 'solto', label: 'Solto' },
  { id: 'maria', label: 'Tranças' },
  { id: 'coque', label: 'Coque' },
]
const SHIRTS = [
  { id: 'rosa', label: 'Rosa', color: '#F4A4C4' },
  { id: 'lilas', label: 'Lilás', color: '#C4B5FD' },
  { id: 'azul', label: 'Azul', color: '#7DD3FC' },
]
const EYES = [
  { id: 'castanho', label: 'Castanho', color: '#7A4E32' },
  { id: 'verde', label: 'Verde', color: '#3D9A4A' },
  { id: 'azul', label: 'Azul', color: '#3B82F6' },
]
const MAKES = ['Natural', 'Rosinha', 'Brilho']
const CHARMS = ['Nenhum', 'Lacinho', 'Tiara', 'Flor', 'Coração', 'Estrela', 'Orelhinha', 'Colar']
const CHARM_COLORS = [
  { label: 'Rosa', color: '#fb7185', deep: '#e11d48' },
  { label: 'Lilás', color: '#c4b5fd', deep: '#7c3aed' },
  { label: 'Vermelho', color: '#f43f5e', deep: '#be123c' },
  { label: 'Amarelo', color: '#facc15', deep: '#ca8a04' },
  { label: 'Azul', color: '#7dd3fc', deep: '#0284c7' },
]

const SPOTS_BY_HAIR: Array<Record<number, { x: number; y: number; size: number; rotate: number }>> = [
  {
    1: { x: 76, y: 52, size: 28, rotate: 16 },
    2: { x: 46, y: 16, size: 40, rotate: -6 },
    3: { x: 26, y: 48, size: 18, rotate: -12 },
    4: { x: 64, y: 30, size: 15, rotate: 6 },
    5: { x: 28, y: 40, size: 15, rotate: -8 },
    6: { x: 46, y: 8, size: 36, rotate: -4 },
    7: { x: 48, y: 84, size: 24, rotate: 0 },
  },
  {
    1: { x: 78, y: 38, size: 28, rotate: 14 },
    2: { x: 50, y: 18, size: 46, rotate: 0 },
    3: { x: 24, y: 44, size: 20, rotate: -8 },
    4: { x: 78, y: 30, size: 16, rotate: 10 },
    5: { x: 22, y: 36, size: 16, rotate: -12 },
    6: { x: 50, y: 8, size: 38, rotate: 0 },
    7: { x: 50, y: 84, size: 24, rotate: 0 },
  },
  {
    1: { x: 50, y: 22, size: 26, rotate: 0 },
    2: { x: 50, y: 18, size: 46, rotate: 0 },
    3: { x: 22, y: 40, size: 18, rotate: -10 },
    4: { x: 78, y: 28, size: 15, rotate: 8 },
    5: { x: 24, y: 32, size: 15, rotate: -8 },
    6: { x: 50, y: 8, size: 36, rotate: 0 },
    7: { x: 50, y: 84, size: 24, rotate: 0 },
  },
  {
    1: { x: 54, y: 16, size: 26, rotate: 8 },
    2: { x: 50, y: 22, size: 44, rotate: 0 },
    3: { x: 62, y: 14, size: 18, rotate: 12 },
    4: { x: 30, y: 36, size: 15, rotate: -8 },
    5: { x: 70, y: 24, size: 15, rotate: 10 },
    6: { x: 50, y: 6, size: 34, rotate: 0 },
    7: { x: 50, y: 84, size: 24, rotate: 0 },
  },
]
const BACKGROUNDS = [
  ['#FBCFE8', '#E9D5FF'],
  ['#F9A8D4', '#C4B5FD'],
  ['#FDE68A', '#F9A8D4'],
  ['#DDD6FE', '#FBCFE8'],
  ['#FCE7F3', '#A78BFA'],
  ['#FECDD3', '#C4B5FD'],
]

const FACES = [
  { cheeks: [[40, 50], [61, 48]], lip: [47, 55] },
  { cheeks: [[36, 50], [64, 50]], lip: [50, 56] },
  { cheeks: [[36, 49], [64, 49]], lip: [50, 55] },
  { cheeks: [[37, 50], [63, 49]], lip: [49, 56] },
]

function portraitSrc(look: AvatarLook) {
  const hair = HAIRS[look.hair] ?? HAIRS[0]
  const shirt = SHIRTS[look.outfit] ?? SHIRTS[0]
  const eyes = EYES[look.eyes] ?? EYES[0]
  return `${import.meta.env.BASE_URL}rotina-${hair.id}-${shirt.id}-${eyes.id}.jpg`
}

export function Avatar({ look, size = 160, className = '' }: { look: AvatarLook; size?: number; className?: string }) {
  const background = BACKGROUNDS[look.background] ?? BACKGROUNDS[0]
  const pad = Math.max(5, Math.round(size * 0.045))
  return (
    <div
      className={`relative shrink-0 rounded-full ${className}`}
      style={{ width: size, height: size, padding: pad, background: `linear-gradient(135deg, ${background[0]}, ${background[1]})` }}
    >
      <img
        src={portraitSrc(look)}
        alt=""
        width={size - pad * 2}
        height={size - pad * 2}
        draggable={false}
        className="h-full w-full rounded-full object-cover"
        style={{ objectPosition: 'center 18%' }}
      />
      <Makeup look={look} />
      <Charm look={look} />
    </div>
  )
}

function Makeup({ look }: { look: AvatarLook }) {
  if (look.make <= 0) return null
  const face = FACES[look.hair] ?? FACES[0]
  const blush = look.make === 2 ? 0.72 : 0.48
  return (
    <div className="pointer-events-none absolute overflow-hidden rounded-full" style={{ inset: '4.5%' }}>
      {face.cheeks.map(([x, y]) => (
        <span
          key={`${x}-${y}`}
          className="absolute rounded-full"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: '18%',
            height: '11%',
            transform: 'translate(-50%, -50%)',
            background: `radial-gradient(circle, rgba(255, 92, 132, ${blush}) 0%, transparent 70%)`,
            mixBlendMode: 'multiply',
          }}
        />
      ))}
      {look.make === 2 ? (
        <span
          className="absolute rounded-full"
          style={{
            left: `${face.lip[0]}%`,
            top: `${face.lip[1]}%`,
            width: '9%',
            height: '3.2%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(255, 130, 156, 0.8)',
            mixBlendMode: 'soft-light',
          }}
        />
      ) : null}
    </div>
  )
}

function Charm({ look }: { look: AvatarLook }) {
  const spot = (SPOTS_BY_HAIR[look.hair] ?? SPOTS_BY_HAIR[0])[look.accessory]
  if (!spot) return null
  const tint = CHARM_COLORS[look.hairColor] ?? CHARM_COLORS[0]
  return (
    <div className="pointer-events-none absolute overflow-hidden rounded-full" style={{ inset: '4.5%' }}>
      <span
        className="absolute"
        style={{
          left: `${spot.x}%`,
          top: `${spot.y}%`,
          width: `${spot.size}%`,
          transform: `translate(-50%, -50%) rotate(${spot.rotate}deg)`,
          filter: 'drop-shadow(0 1px 1px rgba(80, 40, 60, 0.28))',
        }}
      >
        <CharmShape kind={look.accessory} color={tint.color} deep={tint.deep} />
      </span>
    </div>
  )
}

function CharmShape({ kind, color, deep }: { kind: number; color: string; deep: string }) {
  const frame = 'block h-auto w-full'
  if (kind === 1) {
    return (
      <svg viewBox="0 0 64 64" className={frame} aria-hidden="true">
        <ellipse cx="18" cy="26" rx="14" ry="10" fill={color} transform="rotate(-22 18 26)" />
        <ellipse cx="46" cy="26" rx="14" ry="10" fill={color} transform="rotate(22 46 26)" />
        <ellipse cx="18" cy="26" rx="8" ry="5" fill="white" opacity="0.4" transform="rotate(-22 18 26)" />
        <ellipse cx="46" cy="26" rx="8" ry="5" fill="white" opacity="0.4" transform="rotate(22 46 26)" />
        <path d="M26 36 L16 58 L30 46 Z" fill={deep} />
        <path d="M38 36 L48 58 L34 46 Z" fill={deep} />
        <circle cx="32" cy="32" r="6" fill={deep} />
        <circle cx="30" cy="30" r="2" fill="white" opacity="0.85" />
      </svg>
    )
  }
  if (kind === 2) {
    return (
      <svg viewBox="0 0 64 64" className={frame} aria-hidden="true">
        <path d="M4 46 Q32 30 60 46" fill="none" stroke="#f6c445" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M16 42 L22 24 L28 42" fill="#ffe58a" stroke="#e8a800" strokeWidth="1" strokeLinejoin="round" />
        <path d="M26 40 L32 14 L38 40" fill="#ffe58a" stroke="#e8a800" strokeWidth="1" strokeLinejoin="round" />
        <path d="M36 42 L42 24 L48 42" fill="#ffe58a" stroke="#e8a800" strokeWidth="1" strokeLinejoin="round" />
        <circle cx="32" cy="18" r="3.2" fill={color} />
        <circle cx="22" cy="28" r="2.2" fill={color} />
        <circle cx="42" cy="28" r="2.2" fill={color} />
        <circle cx="31" cy="17" r="1.1" fill="white" />
      </svg>
    )
  }
  if (kind === 3) {
    return (
      <svg viewBox="0 0 64 64" className={frame} aria-hidden="true">
        <circle cx="32" cy="16" r="9" fill={color} />
        <circle cx="18" cy="28" r="9" fill={color} />
        <circle cx="46" cy="28" r="9" fill={color} />
        <circle cx="22" cy="44" r="9" fill={color} />
        <circle cx="42" cy="44" r="9" fill={color} />
        <circle cx="32" cy="32" r="7" fill="#fde68a" />
        <circle cx="29" cy="29" r="2" fill="white" />
      </svg>
    )
  }
  if (kind === 4) {
    return (
      <svg viewBox="0 0 64 64" className={frame} aria-hidden="true">
        <path d="M32 54 C14 40 10 24 20 18 C26 14 32 22 32 22 C32 22 38 14 44 18 C54 24 50 40 32 54 Z" fill={color} />
        <ellipse cx="24" cy="26" rx="4" ry="2.4" fill="white" opacity="0.6" transform="rotate(-28 24 26)" />
      </svg>
    )
  }
  if (kind === 5) {
    return (
      <svg viewBox="0 0 64 64" className={frame} aria-hidden="true">
        <path d="M32 8 L37 24 L54 26 L41 37 L45 54 L32 45 L19 54 L23 37 L10 26 L27 24 Z" fill={color} stroke="white" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="28" cy="24" r="2.4" fill="white" opacity="0.85" />
      </svg>
    )
  }
  if (kind === 6) {
    return (
      <svg viewBox="0 0 64 64" className={frame} aria-hidden="true">
        <path d="M8 46 Q32 34 56 46" fill="none" stroke={deep} strokeWidth="3" strokeLinecap="round" />
        <path d="M14 44 C12 22 22 8 28 16 C34 24 32 44 32 44 Z" fill={color} />
        <path d="M32 44 C32 24 36 8 50 16 C56 24 52 44 52 44 Z" fill={color} />
        <path d="M18 42 C18 28 24 20 28 24 C32 30 30 42 30 42 Z" fill={deep} opacity="0.35" />
        <path d="M34 42 C36 28 42 20 48 26 C52 32 48 42 48 42 Z" fill={deep} opacity="0.35" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 64 64" className={frame} aria-hidden="true">
      <path d="M6 24 C16 20 24 28 32 34" fill="none" stroke="#e8b000" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M58 24 C48 20 40 28 32 34" fill="none" stroke="#e8b000" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="12" cy="22" r="1.7" fill="#f6c445" />
      <circle cx="52" cy="22" r="1.7" fill="#f6c445" />
      <circle cx="20" cy="24" r="1.5" fill="#f6c445" />
      <circle cx="44" cy="24" r="1.5" fill="#f6c445" />
      <path d="M32 56 C18 44 12 34 20 28 C26 23 32 31 32 31 C32 31 38 23 44 28 C52 34 46 44 32 56 Z" fill={color} />
      <circle cx="27" cy="34" r="1.7" fill="white" />
    </svg>
  )
}

export function AvatarStudio({ look, onChange }: { look: AvatarLook; onChange: (look: AvatarLook) => void }) {
  const set = (patch: Partial<AvatarLook>) => onChange({ ...look, ...patch })

  return (
    <div className="grid gap-4">
      <div>
        <p className="mb-2 text-sm font-extrabold text-[var(--soft)]">Cabelo</p>
        <div className="flex flex-wrap gap-3">
          {HAIRS.map((hair, index) => {
            const pressed = look.hair === index
            return (
              <button key={hair.id} type="button" aria-label={hair.label} aria-pressed={pressed} onClick={() => set({ hair: index })} className="grid justify-items-center gap-1">
                <img
                  src={`${import.meta.env.BASE_URL}rotina-${hair.id}-rosa-castanho.jpg`}
                  alt=""
                  draggable={false}
                  className="h-16 w-16 rounded-full object-cover"
                  style={{ objectPosition: 'center 18%', boxShadow: pressed ? '0 0 0 3px #e879f9' : '0 0 0 3px white' }}
                />
                <span className="text-xs font-extrabold text-[var(--soft)]">{hair.label}</span>
              </button>
            )
          })}
        </div>
      </div>
      <SwatchRow label="Cor da roupa">
        {SHIRTS.map((shirt, index) => (
          <ColorDot key={shirt.id} color={shirt.color} pressed={look.outfit === index} label={shirt.label} onClick={() => set({ outfit: index })} />
        ))}
      </SwatchRow>
      <SwatchRow label="Olhos">
        {EYES.map((eye, index) => (
          <ColorDot key={eye.id} color={eye.color} pressed={look.eyes === index} label={eye.label} onClick={() => set({ eyes: index })} />
        ))}
      </SwatchRow>
      <div>
        <p className="mb-2 text-sm font-extrabold text-[var(--soft)]">Enfeite</p>
        <div className="flex flex-wrap gap-2">
          {CHARMS.map((name, index) => {
            const pressed = look.accessory === index
            const tint = CHARM_COLORS[look.hairColor] ?? CHARM_COLORS[0]
            return (
              <button key={name} type="button" aria-label={name} aria-pressed={pressed} onClick={() => set({ accessory: index })} className="grid w-14 justify-items-center gap-0.5">
                <span
                  className="grid h-12 w-12 place-items-center rounded-2xl border-2 bg-white"
                  style={{ borderColor: pressed ? '#e879f9' : 'white', boxShadow: pressed ? '0 0 0 3px #fbcfe8' : undefined }}
                >
                  {index === 0 ? (
                    <span className="text-[10px] font-extrabold leading-tight text-[var(--soft)]">Sem</span>
                  ) : (
                    <span className="block w-8">
                      <CharmShape kind={index} color={tint.color} deep={tint.deep} />
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-extrabold leading-tight text-[var(--soft)]">{name}</span>
              </button>
            )
          })}
        </div>
      </div>
      <SwatchRow label="Cor do enfeite">
        {CHARM_COLORS.map((tint, index) => (
          <ColorDot key={tint.label} color={tint.color} pressed={look.hairColor === index} label={tint.label} onClick={() => set({ hairColor: index })} />
        ))}
      </SwatchRow>
      <div>
        <p className="mb-2 text-sm font-extrabold text-[var(--soft)]">Make</p>
        <div className="flex flex-wrap gap-2">
          {MAKES.map((name, index) => (
            <button key={name} type="button" className="choice" aria-pressed={look.make === index} onClick={() => set({ make: index })}>
              {name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-extrabold text-[var(--soft)]">Fundo</p>
        <div className="flex flex-wrap gap-2">
          {BACKGROUNDS.map((colors, index) => (
            <button
              key={colors.join('-')}
              type="button"
              aria-label={`Fundo ${index + 1}`}
              aria-pressed={look.background === index}
              onClick={() => set({ background: index })}
              className="h-10 w-10 rounded-full border-2"
              style={{ background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`, borderColor: look.background === index ? '#e879f9' : 'white' }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function SwatchRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-extrabold text-[var(--soft)]">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function ColorDot({ color, pressed, label, onClick }: { color: string; pressed: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className="h-10 w-10 rounded-full border-2"
      style={{ background: color, borderColor: pressed ? '#e879f9' : 'white', boxShadow: pressed ? '0 0 0 3px #fbcfe8' : undefined }}
    />
  )
}
