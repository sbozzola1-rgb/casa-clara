import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Avatar, AvatarStudio } from './avatar.tsx'
import { leaveRoutine, pinRoutine, routinePinned } from './door.ts'
import { dateKey, defaultAvatar, formatLong, TABS, type AvatarLook } from './model.ts'
import './routine.css'
import { RoutineScheduler } from './scheduler.tsx'
import { ActivityScreen, ActivityTimer, GradeScreen, HomeworkScreen, MealScreen, PixScreen, SchoolScreen, TodayScreen } from './screens.tsx'
import { askNotificationPermission } from './sound.ts'
import { RoutineProvider, useRoutine } from './store.tsx'
import { Field, Modal, PinPad, TextInput } from './ui.tsx'

type Gate = 'enter' | 'create' | 'confirm' | 'word' | 'forgot'

export default function RoutineApp({ onLeave }: { onLeave: () => void }) {
  return (
    <RoutineProvider>
      <Shell onLeave={onLeave} />
    </RoutineProvider>
  )
}

function Shell({ onLeave }: { onLeave: () => void }) {
  const { state, role, tab, setTab, today, toast, leaveParent, notify } = useRoutine()
  const [gate, setGate] = useState<Gate | null>(null)
  const [settings, setSettings] = useState(false)
  const [skippedHandoff, setSkippedHandoff] = useState(false)
  const profile = state.profile

  useEffect(() => {
    const base = import.meta.env.BASE_URL
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register(`${base}routine-sw.js`).catch(() => undefined)
    const link = document.createElement('link')
    link.rel = 'manifest'
    link.href = `${base}rotina.webmanifest`
    document.head.appendChild(link)
    const theme = document.querySelector('meta[name="theme-color"]')
    const previousTheme = theme?.getAttribute('content')
    theme?.setAttribute('content', '#fbcfe8')
    const previousTitle = document.title
    return () => {
      link.remove()
      if (theme && previousTheme) theme.setAttribute('content', previousTheme)
      document.title = previousTitle
    }
  }, [])

  useEffect(() => {
    document.title = profile ? `Rotina de ${profile.name}` : 'Rotina'
  }, [profile])

  if (!profile) return <Onboarding />

  if (!profile.pin && !skippedHandoff) {
    return (
      <>
        <Handoff name={profile.name} look={profile.avatar} onCreate={() => setGate('create')} onSkip={() => setSkippedHandoff(true)} />
        {gate ? (
          <PinGate
            mode={gate}
            onMode={setGate}
            onClose={() => setGate(null)}
            onReady={() => {
              setGate(null)
              notify('Área dos pais aberta')
            }}
          />
        ) : null}
      </>
    )
  }

  const openGate = () => setGate(profile.pin ? 'enter' : 'create')

  return (
    <div className="routine-root relative min-h-screen md:grid md:grid-cols-[250px_1fr]">
      <Sky />
      <aside className="relative z-10 hidden md:flex md:flex-col md:px-4 md:py-6">
        <div className="px-3 pb-6">
          <p className="font-display text-4xl leading-none">Cantinho</p>
          <p className="mt-1 text-sm font-extrabold text-[var(--soft)]">Rotina de {profile.name}</p>
        </div>
        <nav className="grid gap-1">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={tab === item.id ? 'page' : undefined}
              onClick={() => setTab(item.id)}
              className="nav-pill flex items-center gap-3 rounded-2xl px-3 py-3 text-left font-extrabold"
            >
              <span className="text-xl">{item.emoji}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="relative z-10 min-w-0">
        <header className="sticky top-0 z-20 px-4 py-4 backdrop-blur md:px-8">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar look={profile.avatar} size={56} />
              <div className="min-w-0">
                <p className="truncate text-xs font-extrabold tracking-wide text-[var(--soft)] uppercase">{formatLong(today)}</p>
                <p className="font-display truncate text-2xl">Oi, {profile.name}!</p>
              </div>
            </div>
            {role === 'parent' ? (
              <div className="flex gap-2">
                <button type="button" className="btn-ghost min-h-11 px-4 text-sm" onClick={() => setSettings(true)}>
                  Ajustes
                </button>
                <button type="button" className="btn-primary min-h-11 px-4 text-sm" onClick={leaveParent}>
                  Ver como ela vê
                </button>
              </div>
            ) : (
              <button type="button" className="btn-ghost min-h-11 px-4 text-sm" onClick={openGate}>
                Pais
              </button>
            )}
          </div>
          {role === 'parent' ? (
            <p className="mt-3 rounded-full bg-white/80 px-4 py-2 text-sm font-extrabold text-fuchsia-600">Área dos pais — ela só consegue marcar como feito.</p>
          ) : null}
        </header>

        <main className="px-4 pt-2 pb-28 md:px-8 md:pb-12">
          {tab === 'hoje' ? <TodayScreen /> : null}
          {tab === 'escola' ? <SchoolScreen /> : null}
          {tab === 'licao' ? <HomeworkScreen /> : null}
          {tab === 'atividades' ? <ActivityScreen /> : null}
          {tab === 'refeicoes' ? <MealScreen /> : null}
          {tab === 'notas' ? <GradeScreen /> : null}
          {tab === 'pix' ? <PixScreen /> : null}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex gap-2 overflow-x-auto border-t border-white/70 bg-white/85 px-3 py-2 backdrop-blur md:hidden">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-current={tab === item.id ? 'page' : undefined}
            onClick={() => setTab(item.id)}
            className="nav-pill flex shrink-0 flex-col items-center rounded-2xl px-3 py-2 text-[11px] font-extrabold"
          >
            <span className="text-lg">{item.emoji}</span>
            {item.label}
          </button>
        ))}
      </nav>

      <RoutineScheduler />
      <ActivityTimer />
      {gate ? (
        <PinGate
          mode={gate}
          onMode={setGate}
          onClose={() => setGate(null)}
          onReady={() => {
            setGate(null)
            notify('Área dos pais aberta')
          }}
        />
      ) : null}
      {settings ? (
        <Settings
          onClose={() => setSettings(false)}
          onChangePin={() => {
            setSettings(false)
            setGate('create')
          }}
          onLeave={() => {
            leaveRoutine()
            onLeave()
          }}
        />
      ) : null}
      {toast ? (
        <div role="status" className="fixed top-6 left-1/2 z-[75] -translate-x-1/2 rounded-full bg-[#5b3a63] px-5 py-2 font-extrabold text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  )
}

function Handoff({ name, look, onCreate, onSkip }: { name: string; look: AvatarLook; onCreate: () => void; onSkip: () => void }) {
  return (
    <div className="routine-root relative grid min-h-screen place-items-center px-6">
      <Sky />
      <section className="card relative z-10 w-full max-w-md px-6 py-8 text-center">
        <Avatar look={look} size={160} className="avatar-bob mx-auto" />
        <h1 className="font-display mt-2 text-4xl">Que lindo, {name}!</h1>
        <p className="mt-3 text-[var(--soft)]">Agora entrega o tablet para a mamãe. Ela cria um PIN e cadastra a rotina. Você vai poder marcar cada coisa como feita.</p>
        <button type="button" className="btn-primary mt-6 w-full" onClick={onCreate}>
          Sou a mamãe
        </button>
        <button type="button" className="btn-ghost mt-3 w-full" onClick={onSkip}>
          Agora não
        </button>
      </section>
    </div>
  )
}

function Onboarding() {
  const { saveProfile } = useRoutine()
  const [name, setName] = useState('')
  const [look, setLook] = useState<AvatarLook>(defaultAvatar)

  return (
    <div className="routine-root relative min-h-screen">
      <Sky />
      <div className="relative z-10 mx-auto grid max-w-5xl items-center gap-8 px-6 py-10 md:grid-cols-[280px_1fr]">
        <div className="text-center">
          <Avatar look={look} size={230} className="avatar-bob mx-auto" />
          <p className="font-display mt-2 text-4xl">{name.trim() || 'Oi!'}</p>
        </div>
        <section className="card px-6 py-6 md:px-8 md:py-8">
          <h1 className="font-display text-4xl">Vamos criar o seu cantinho</h1>
          <p className="mt-2 text-[var(--soft)]">Escreva seu nome e monte o bonequinho do jeitinho que você é.</p>
          <label className="mt-5 grid gap-1.5 font-extrabold">
            Seu nome
            <input className="field-input" maxLength={24} autoFocus value={name} placeholder="Seu nome" onChange={(event) => setName(event.target.value)} />
          </label>
          <div className="mt-5">
            <AvatarStudio look={look} onChange={setLook} />
          </div>
          <button
            type="button"
            className="btn-primary mt-6 w-full"
            disabled={name.trim().length === 0}
            onClick={() => saveProfile({ name: name.trim(), avatar: look, pin: '', recovery: '' })}
          >
            É assim que eu sou!
          </button>
        </section>
      </div>
    </div>
  )
}

function PinGate({ mode, onMode, onClose, onReady }: { mode: Gate; onMode: (mode: Gate) => void; onClose: () => void; onReady: () => void }) {
  const { state, unlock, setPin, resetPin } = useRoutine()
  const [code, setCode] = useState('')
  const [first, setFirst] = useState('')
  const [secret, setSecret] = useState('')
  const [error, setError] = useState('')
  const [shake, setShake] = useState(false)

  const fail = (message: string) => {
    setError(message)
    setShake(true)
    setCode('')
    window.setTimeout(() => setShake(false), 400)
  }

  const onCode = (next: string) => {
    setCode(next)
    setError('')
    if (next.length < 4) return
    if (mode === 'enter') {
      if (unlock(next)) onReady()
      else fail('PIN incorreto.')
      return
    }
    if (mode === 'create') {
      setFirst(next)
      setCode('')
      onMode('confirm')
      return
    }
    if (next !== first) {
      fail('Os números não são iguais.')
      return
    }
    if (state.profile?.recovery) {
      setPin(next)
      onReady()
      return
    }
    setFirst(next)
    setCode('')
    onMode('word')
  }

  const saveWord = (event: FormEvent) => {
    event.preventDefault()
    if (secret.trim().length < 3) {
      setError('Use uma palavra com pelo menos 3 letras.')
      return
    }
    setPin(first, secret)
    onReady()
  }

  const recover = (event: FormEvent) => {
    event.preventDefault()
    if (!state.profile?.recovery) {
      setError('Ainda não há palavra secreta neste tablet.')
      return
    }
    if (!resetPin(secret)) {
      setError('Essa não é a palavra secreta.')
      return
    }
    setSecret('')
    setCode('')
    setFirst('')
    onMode('create')
  }

  const title = mode === 'enter' ? 'Área dos pais' : mode === 'confirm' ? 'Repita o PIN' : mode === 'word' ? 'Palavra só sua' : mode === 'forgot' ? 'Recuperar o PIN' : 'Crie um PIN'
  const description = mode === 'enter'
    ? 'O PIN abre o cadastro. Ela continua só marcando como feito.'
    : mode === 'word'
      ? 'Guarde uma palavra que ela não saiba. Ela recupera o PIN se você esquecer.'
      : mode === 'forgot'
        ? 'Escreva a palavra secreta que você guardou.'
        : 'Quatro números que só você sabe.'

  return (
    <Modal title={title} description={description} onClose={onClose}>
      {mode === 'word' || mode === 'forgot' ? (
        <form onSubmit={mode === 'word' ? saveWord : recover} className="grid gap-4">
          <Field label={mode === 'word' ? 'Palavra secreta' : 'Palavra secreta'}>
            <TextInput value={secret} autoFocus autoComplete="off" onChange={(event) => setSecret(event.target.value)} />
          </Field>
          {error ? <p className="text-sm font-bold text-rose-500">{error}</p> : null}
          <button type="submit" className="btn-primary">{mode === 'word' ? 'Guardar e entrar' : 'Apagar o PIN'}</button>
        </form>
      ) : (
        <div className={shake ? 'shake' : ''}>
          <PinPad value={code} onChange={onCode} />
          {error ? <p className="mt-4 text-center text-sm font-bold text-rose-500">{error}</p> : null}
          {mode === 'enter' ? (
            <button type="button" className="mt-4 w-full text-sm font-extrabold text-[var(--soft)]" onClick={() => { setError(''); setSecret(''); onMode('forgot') }}>
              Esqueci o PIN
            </button>
          ) : null}
        </div>
      )}
    </Modal>
  )
}

function Settings({ onClose, onChangePin, onLeave }: { onClose: () => void; onChangePin: () => void; onLeave: () => void }) {
  const { state, saveProfile, replaceState, notify } = useRoutine()
  const profile = state.profile
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(profile?.name ?? '')
  const [look, setLook] = useState<AvatarLook>(profile?.avatar ?? defaultAvatar())
  const [pinned, setPinned] = useState(routinePinned)

  if (!profile) return null

  const saveLook = () => {
    if (!name.trim()) {
      notify('Escreva o nome dela')
      return
    }
    saveProfile({ ...profile, name: name.trim(), avatar: look })
    notify('Cantinho atualizado')
  }

  const download = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `rotina-${profile.name}-${dateKey()}.json`
    link.click()
    URL.revokeObjectURL(url)
    notify('Cópia baixada')
  }

  return (
    <Modal
      title="Ajustes"
      description="Nome, avatar, PIN e este tablet."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Fechar
          </button>
          <button type="button" className="btn-primary" onClick={saveLook}>
            Salvar cantinho
          </button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="flex justify-center">
          <Avatar look={look} size={140} className="avatar-bob" />
        </div>
        <Field label="Nome">
          <TextInput value={name} maxLength={24} onChange={(event) => setName(event.target.value)} />
        </Field>
        <AvatarStudio look={look} onChange={setLook} />
        <button type="button" className="btn-ghost" onClick={onChangePin}>
          Trocar o PIN
        </button>
        <button type="button" className="btn-soft" onClick={() => void askNotificationPermission()}>
          Ativar avisos neste tablet
        </button>
        <button
          type="button"
          className="rounded-2xl bg-white px-4 py-3 text-left font-extrabold"
          onClick={() => {
            const next = !pinned
            pinRoutine(next)
            setPinned(next)
            notify(next ? 'Este tablet abre na rotina' : 'Este tablet abre nas finanças')
          }}
        >
          {pinned ? 'Este tablet abre direto na rotina' : 'Abrir a rotina sempre neste tablet'}
        </button>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-ghost" onClick={download}>
            Baixar cópia
          </button>
          <button type="button" className="btn-ghost" onClick={() => fileRef.current?.click()}>
            Restaurar
          </button>
        </div>
        <button type="button" className="text-sm font-extrabold text-[var(--soft)]" onClick={onLeave}>
          Ir para as finanças
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (!file) return
            void file.text().then((text) => {
              replaceState(JSON.parse(text))
              notify('Rotina restaurada')
              onClose()
            }).catch(() => notify('Não consegui ler esse arquivo')).finally(() => {
              event.target.value = ''
            })
          }}
        />
      </div>
    </Modal>
  )
}

function Sky() {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
      <span className="blob blob-a" />
      <span className="blob blob-b" />
      <span className="blob blob-c" />
      <span className="sparkle sparkle-1">✦</span>
      <span className="sparkle sparkle-2">♥</span>
      <span className="sparkle sparkle-3">✦</span>
    </div>
  )
}
