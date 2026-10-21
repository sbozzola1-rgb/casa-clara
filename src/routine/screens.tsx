import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import {
  activityOccurs,
  ALL_DAYS,
  dateKey,
  daysLabel,
  doneKey,
  formatShort,
  frequencyLabel,
  homeworkKey,
  isSwimWeek,
  money,
  nextAlarm,
  occursOn,
  pixKey,
  recentDates,
  schoolOccurs,
  weekLabel,
  SCHOOL_DAYS,
  SUBJECTS,
  todayTasks,
  uid,
  type ActivityItem,
  type AlarmItem,
  type GradeItem,
  type HomeworkItem,
  type MealItem,
  type SchoolItem,
} from './model.ts'
import { askNotificationPermission, playPop } from './sound.ts'
import { useRoutine } from './store.tsx'
import { DayField, EmptyState, EmojiField, Field, FormModal, ItemCard, Modal, TextInput, ToggleRow } from './ui.tsx'

function PageHeader({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-4xl">{title}</h1>
        <p className="mt-1 max-w-xl text-[var(--soft)]">{text}</p>
      </div>
      {action}
    </div>
  )
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" className="btn-primary" onClick={onClick}>
      {label}
    </button>
  )
}

function ConfirmRemove({ title, onClose, onConfirm }: { title: string; onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal
      title="Apagar?"
      description="Isso sai da rotina dela."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="btn-primary" onClick={onConfirm}>
            Apagar
          </button>
        </>
      }
    >
      <p className="font-extrabold">{title}</p>
    </Modal>
  )
}

function useCheck() {
  const { state, toggleDone, notify } = useRoutine()
  return (kind: 'school' | 'activity' | 'meal' | 'homework', id: string, done: boolean) => {
    if (kind === 'activity' && done && state.pixPaid[pixKey(id, dateKey())]) {
      notify('O Pix deste dia já foi enviado')
      return
    }
    if (!done) playPop()
    toggleDone(kind, id)
  }
}

function atDate(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

export function TodayScreen() {
  const { state, role, today, setTab } = useRoutine()
  const check = useCheck()
  const tasks = todayTasks(state, today)
  const done = tasks.filter((task) => task.done).length
  const upcoming = nextAlarm(state.alarms, today)
  const soon = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2)
  const soonLimit = dateKey(soon)
  const lessons = state.homework.filter((item) => !state.done[homeworkKey(item.id)] && item.due <= soonLimit)
  const profile = state.profile

  return (
    <div className="grid gap-4">
      <section className="card overflow-hidden px-6 py-6 md:px-8">
        <p className="text-sm font-extrabold tracking-wide text-[var(--soft)] uppercase">Cantinho de hoje</p>
        <h1 className="font-display mt-1 text-4xl md:text-5xl">Oi, {profile?.name}!</h1>
        <p className="mt-2 max-w-lg text-lg text-[var(--soft)]">
          {tasks.length === 0
            ? 'Quando a rotina estiver pronta, suas estrelinhas aparecem aqui.'
            : done === tasks.length
              ? 'Você completou tudo de hoje. Que dia lindo!'
              : 'Marque cada coisinha quando terminar.'}
        </p>
        <div className="mt-5 h-3 overflow-hidden rounded-full bg-white">
          <div className="h-full rounded-full bg-gradient-to-r from-pink-400 to-violet-400" style={{ width: `${tasks.length === 0 ? 0 : Math.round((done / tasks.length) * 100)}%` }} />
        </div>
        <p className="mt-2 text-sm font-extrabold text-[var(--soft)]">{tasks.length === 0 ? 'Nada marcado para hoje' : `${done} de ${tasks.length} prontinhas`}</p>
      </section>

      {upcoming ? (
        <button type="button" onClick={() => setTab('despertador')} className="card flex items-center gap-4 px-5 py-4 text-left">
          <span className="text-4xl">{upcoming.alarm.emoji}</span>
          <span>
            <span className="block text-sm font-extrabold text-[var(--soft)]">Próximo despertador</span>
            <span className="font-display block text-2xl">
              {upcoming.alarm.time} · {upcoming.alarm.label}
            </span>
          </span>
        </button>
      ) : null}

      {tasks.length === 0 ? (
        <EmptyState emoji="🌸" title="Hoje está livre" text={role === 'parent' ? 'Cadastre a escola, as atividades e as refeições.' : 'A mamãe ainda vai montar o seu dia.'} />
      ) : (
        <div className="grid gap-3">
          {tasks.map((task) => (
            <ItemCard
              key={`${task.kind}-${task.id}`}
              emoji={task.emoji}
              title={task.title}
              meta={[task.time, task.kind === 'school' ? 'Escola' : task.kind === 'meal' ? 'Refeição' : 'Atividade', task.pix ? 'Tem Pix' : ''].filter(Boolean).join(' · ')}
              done={task.done}
              canToggle
              onToggle={() => check(task.kind, task.id, task.done)}
            />
          ))}
        </div>
      )}

      {lessons.length > 0 ? (
        <section>
          <h2 className="font-display mb-3 text-2xl">Lição chegando</h2>
          <div className="grid gap-3">
            {lessons.map((item) => (
              <ItemCard
                key={item.id}
                emoji={item.emoji}
                title={item.title}
                meta={`${item.subject} · ${item.due === dateKey(today) ? 'Para hoje' : item.due < dateKey(today) ? 'Atrasada' : `Até ${formatShort(item.due)}`}`}
                canToggle
                onToggle={() => check('homework', item.id, false)}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

export function SchoolScreen() {
  const { state, role, today, saveSchool, removeSchool } = useRoutine()
  const check = useCheck()
  const [draft, setDraft] = useState<SchoolItem | null>(null)
  const [error, setError] = useState('')
  const [removeId, setRemoveId] = useState<string | null>(null)
  const day = dateKey(today)
  const visible = (role === 'parent' ? state.school : state.school.filter((item) => schoolOccurs(item, today))).slice().sort((a, b) => {
    if (role === 'parent') {
      const day = (a.days[0] ?? 0) - (b.days[0] ?? 0)
      if (day) return day
    }
    return a.start.localeCompare(b.start)
  })
  const removing = state.school.find((item) => item.id === removeId)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!draft?.title.trim()) {
      setError('Escreva o nome.')
      return
    }
    if (!draft.start) {
      setError('Escolha o horário.')
      return
    }
    saveSchool({ ...draft, title: draft.title.trim(), days: draft.days.length ? draft.days : SCHOOL_DAYS })
    setDraft(null)
  }

  return (
    <div>
      <PageHeader
        title="Rotina da escola"
        text={role === 'parent' ? `Horário da Laura até 15 de dezembro. ${isSwimWeek(today) ? 'Esta semana tem natação.' : 'Esta semana tem robótica.'}` : 'Marque o que você já fez na escola.'}
        action={role === 'parent' ? <AddButton label="Nova aula" onClick={() => { setError(''); setDraft({ id: uid(), title: '', emoji: '🎒', start: '07:30', end: '', days: SCHOOL_DAYS, week: 'all', until: '' }) }} /> : null}
      />
      {visible.length === 0 ? (
        <EmptyState emoji="🎒" title="Sem aula por aqui" text={role === 'parent' ? 'Adicione a primeira aula da rotina.' : 'Hoje não tem rotina de escola.'} />
      ) : (
        <div className="grid gap-3">
          {visible.map((item) => {
            const done = Boolean(state.done[doneKey('school', item.id, day)])
            const happens = schoolOccurs(item, today)
            if (role !== 'parent' && !happens) return null
            const when = [item.end ? `${item.start} – ${item.end}` : item.start, daysLabel(item.days), weekLabel(item.week)].filter(Boolean).join(' · ')
            return (
              <ItemCard
                key={item.id}
                emoji={item.emoji}
                title={item.title}
                meta={when}
                done={happens ? done : undefined}
                canToggle={happens}
                onToggle={() => check('school', item.id, done)}
                onEdit={role === 'parent' ? () => { setError(''); setDraft(item) } : undefined}
                onDelete={role === 'parent' ? () => setRemoveId(item.id) : undefined}
              />
            )
          })}
        </div>
      )}
      {draft ? (
        <FormModal title={state.school.some((item) => item.id === draft.id) ? 'Editar aula' : 'Nova aula'} onClose={() => setDraft(null)} onSubmit={submit}>
          <EmojiField value={draft.emoji} onChange={(emoji) => setDraft({ ...draft, emoji })} />
          <Field label="Nome">
            <TextInput value={draft.title} maxLength={60} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Começa">
              <TextInput type="time" value={draft.start} onChange={(event) => setDraft({ ...draft, start: event.target.value })} />
            </Field>
            <Field label="Termina">
              <TextInput type="time" value={draft.end} onChange={(event) => setDraft({ ...draft, end: event.target.value })} />
            </Field>
          </div>
          <DayField value={draft.days} onChange={(days) => setDraft({ ...draft, days })} />
          {error ? <p className="text-sm font-bold text-rose-500">{error}</p> : null}
        </FormModal>
      ) : null}
      {removing ? <ConfirmRemove title={removing.title} onClose={() => setRemoveId(null)} onConfirm={() => { removeSchool(removing.id); setRemoveId(null) }} /> : null}
    </div>
  )
}

export function HomeworkScreen() {
  const { state, role, today, saveHomework, removeHomework } = useRoutine()
  const check = useCheck()
  const [draft, setDraft] = useState<HomeworkItem | null>(null)
  const [error, setError] = useState('')
  const [removeId, setRemoveId] = useState<string | null>(null)
  const todayIso = dateKey(today)
  const pending = state.homework.filter((item) => !state.done[homeworkKey(item.id)]).sort((a, b) => a.due.localeCompare(b.due))
  const finished = state.homework.filter((item) => state.done[homeworkKey(item.id)])
  const removing = state.homework.find((item) => item.id === removeId)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!draft?.title.trim() || !draft.due) {
      setError('Escreva a lição e o dia de entregar.')
      return
    }
    saveHomework({ ...draft, title: draft.title.trim(), note: draft.note.trim() })
    setDraft(null)
  }

  const card = (item: HomeworkItem) => {
    const done = Boolean(state.done[homeworkKey(item.id)])
    const when = item.due < todayIso ? 'Atrasada' : item.due === todayIso ? 'Para hoje' : `Até ${formatShort(item.due)}`
    return (
      <ItemCard
        key={item.id}
        emoji={item.emoji}
        title={item.title}
        meta={`${item.subject} · ${when}`}
        done={done}
        canToggle
        onToggle={() => check('homework', item.id, done)}
        onEdit={role === 'parent' ? () => { setError(''); setDraft(item) } : undefined}
        onDelete={role === 'parent' ? () => setRemoveId(item.id) : undefined}
        extra={item.note ? <p className="mt-1 text-sm">{item.note}</p> : null}
      />
    )
  }

  return (
    <div>
      <PageHeader
        title="Lição de casa"
        text={role === 'parent' ? 'Cadastre o que precisa ser entregue.' : 'Toque em Feito quando terminar a lição.'}
        action={role === 'parent' ? <AddButton label="Nova lição" onClick={() => { setError(''); setDraft({ id: uid(), subject: 'Matemática', title: '', due: todayIso, note: '', emoji: '✏️' }) }} /> : null}
      />
      {state.homework.length === 0 ? (
        <EmptyState emoji="✏️" title="Nenhuma lição" text={role === 'parent' ? 'Adicione a próxima tarefa da escola.' : 'Nenhuma lição esperando por você.'} />
      ) : (
        <div className="grid gap-6">
          <div className="grid gap-3">{pending.map(card)}</div>
          {finished.length > 0 ? (
            <section>
              <h2 className="font-display mb-3 text-2xl">Já entregues</h2>
              <div className="grid gap-3">{finished.map(card)}</div>
            </section>
          ) : null}
        </div>
      )}
      {draft ? (
        <FormModal title={state.homework.some((item) => item.id === draft.id) ? 'Editar lição' : 'Nova lição'} onClose={() => setDraft(null)} onSubmit={submit}>
          <EmojiField value={draft.emoji} onChange={(emoji) => setDraft({ ...draft, emoji })} />
          <Field label="Matéria">
            <select className="field-input" value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })}>
              {SUBJECTS.map((subject) => <option key={subject}>{subject}</option>)}
            </select>
          </Field>
          <Field label="Lição">
            <TextInput value={draft.title} maxLength={80} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          </Field>
          <Field label="Entregar em">
            <TextInput type="date" value={draft.due} onChange={(event) => setDraft({ ...draft, due: event.target.value })} />
          </Field>
          <Field label="Recado">
            <TextInput value={draft.note} maxLength={180} onChange={(event) => setDraft({ ...draft, note: event.target.value })} />
          </Field>
          {error ? <p className="text-sm font-bold text-rose-500">{error}</p> : null}
        </FormModal>
      ) : null}
      {removing ? <ConfirmRemove title={removing.title} onClose={() => setRemoveId(null)} onConfirm={() => { removeHomework(removing.id); setRemoveId(null) }} /> : null}
    </div>
  )
}

export function AlarmScreen() {
  const { state, role, saveAlarm, removeAlarm } = useRoutine()
  const [now, setNow] = useState(() => new Date())
  const [draft, setDraft] = useState<AlarmItem | null>(null)
  const [error, setError] = useState('')
  const [removeId, setRemoveId] = useState<string | null>(null)
  const removing = state.alarms.find((item) => item.id === removeId)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!draft?.label.trim() || !draft.time || draft.days.length === 0) {
      setError('Dê um nome, um horário e pelo menos um dia.')
      return
    }
    saveAlarm({ ...draft, label: draft.label.trim() })
    void askNotificationPermission()
    setDraft(null)
  }

  return (
    <div>
      <PageHeader
        title="Despertador"
        text="Deixe o cantinho aberto no tablet. Na hora, ele toca e mostra um aviso."
        action={role === 'parent' ? <AddButton label="Novo horário" onClick={() => { setError(''); setDraft({ id: uid(), label: '', emoji: '⏰', time: '07:00', days: ALL_DAYS, enabled: true }) }} /> : null}
      />
      <section className="card mb-4 px-6 py-6 text-center">
        <p className="font-display text-6xl">{now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
        <p className="mt-1 text-sm font-bold text-[var(--soft)]">Hora deste tablet</p>
        <button type="button" className="btn-soft mt-4" onClick={() => void askNotificationPermission()}>
          Ativar avisos neste tablet
        </button>
      </section>
      {state.alarms.length === 0 ? (
        <EmptyState emoji="⏰" title="Nenhum despertador" text={role === 'parent' ? 'Crie o horário de acordar, da escola ou de dormir.' : 'A mamãe ainda vai colocar os horários.'} />
      ) : (
        <div className="grid gap-3">
          {state.alarms.map((alarm) => (
            <ItemCard
              key={alarm.id}
              emoji={alarm.emoji}
              title={alarm.label}
              meta={`${alarm.time} · ${daysLabel(alarm.days)}${alarm.enabled ? '' : ' · pausado'}`}
              onEdit={role === 'parent' ? () => { setError(''); setDraft(alarm) } : undefined}
              onDelete={role === 'parent' ? () => setRemoveId(alarm.id) : undefined}
              extra={role === 'parent' ? (
                <button type="button" className="mt-2 text-sm font-extrabold text-fuchsia-500" onClick={() => saveAlarm({ ...alarm, enabled: !alarm.enabled })}>
                  {alarm.enabled ? 'Pausar' : 'Ativar'}
                </button>
              ) : null}
            />
          ))}
        </div>
      )}
      {draft ? (
        <FormModal title={state.alarms.some((item) => item.id === draft.id) ? 'Editar despertador' : 'Novo despertador'} onClose={() => setDraft(null)} onSubmit={submit}>
          <EmojiField value={draft.emoji} onChange={(emoji) => setDraft({ ...draft, emoji })} />
          <Field label="Nome">
            <TextInput value={draft.label} maxLength={60} placeholder="Acordar" onChange={(event) => setDraft({ ...draft, label: event.target.value })} />
          </Field>
          <Field label="Horário">
            <TextInput type="time" value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} />
          </Field>
          <DayField value={draft.days} onChange={(days) => setDraft({ ...draft, days })} />
          <ToggleRow label="Despertador ligado" checked={draft.enabled} onChange={(enabled) => setDraft({ ...draft, enabled })} />
          {error ? <p className="text-sm font-bold text-rose-500">{error}</p> : null}
        </FormModal>
      ) : null}
      {removing ? <ConfirmRemove title={removing.label} onClose={() => setRemoveId(null)} onConfirm={() => { removeAlarm(removing.id); setRemoveId(null) }} /> : null}
    </div>
  )
}

export function ActivityScreen() {
  const { state, role, today, saveActivity, removeActivity } = useRoutine()
  const check = useCheck()
  const [draft, setDraft] = useState<ActivityItem | null>(null)
  const [error, setError] = useState('')
  const [removeId, setRemoveId] = useState<string | null>(null)
  const day = dateKey(today)
  const visible = role === 'parent' ? state.activities : state.activities.filter((item) => activityOccurs(item, today))
  const removing = state.activities.find((item) => item.id === removeId)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!draft?.title.trim() || !draft.time) {
      setError('Escreva a atividade e o horário.')
      return
    }
    if (draft.frequency === 'weekly' && draft.days.length === 0) {
      setError('Escolha os dias da semana.')
      return
    }
    if (draft.pixEnabled && draft.pixAmount <= 0) {
      setError('Diga o valor do Pix.')
      return
    }
    saveActivity({
      ...draft,
      title: draft.title.trim(),
      note: draft.note.trim(),
      pixNote: draft.pixNote.trim(),
      pixAmount: draft.pixEnabled ? draft.pixAmount : 0,
    })
    if (draft.notify) void askNotificationPermission()
    setDraft(null)
  }

  return (
    <div>
      <PageHeader
        title="Atividades"
        text={role === 'parent' ? 'Diária ou semanal. No horário, o tablet avisa. O Pix, se existir, só você marca.' : 'Marque como feito quando terminar.'}
        action={role === 'parent' ? <AddButton label="Nova atividade" onClick={() => { setError(''); setDraft({ id: uid(), title: '', emoji: '⭐', note: '', frequency: 'daily', days: SCHOOL_DAYS, time: '16:00', notify: true, pixEnabled: false, pixAmount: 5, pixNote: '' }) }} /> : null}
      />
      {visible.length === 0 ? (
        <EmptyState emoji="⭐" title="Nenhuma atividade" text={role === 'parent' ? 'Crie a primeira atividade do dia ou da semana.' : 'Hoje não tem atividade.'} />
      ) : (
        <div className="grid gap-3">
          {visible.map((item) => {
            const happens = activityOccurs(item, today)
            const done = Boolean(state.done[doneKey('activity', item.id, day)])
            return (
              <ItemCard
                key={item.id}
                emoji={item.emoji}
                title={item.title}
                meta={`${frequencyLabel(item)} · ${item.time}${item.notify ? ' · avisa' : ''}${item.pixEnabled ? ` · Pix ${money(item.pixAmount)}` : ''}`}
                done={happens ? done : undefined}
                canToggle={happens}
                onToggle={() => check('activity', item.id, done)}
                onEdit={role === 'parent' ? () => { setError(''); setDraft(item) } : undefined}
                onDelete={role === 'parent' ? () => setRemoveId(item.id) : undefined}
                extra={item.note ? <p className="mt-1 text-sm">{item.note}</p> : null}
              />
            )
          })}
        </div>
      )}
      {draft ? (
        <FormModal title={state.activities.some((item) => item.id === draft.id) ? 'Editar atividade' : 'Nova atividade'} onClose={() => setDraft(null)} onSubmit={submit}>
          <EmojiField value={draft.emoji} onChange={(emoji) => setDraft({ ...draft, emoji })} />
          <Field label="Atividade">
            <TextInput value={draft.title} maxLength={60} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          </Field>
          <Field label="Recado">
            <TextInput value={draft.note} maxLength={180} onChange={(event) => setDraft({ ...draft, note: event.target.value })} />
          </Field>
          <div>
            <p className="mb-2 text-sm font-extrabold">Repete</p>
            <div className="flex gap-2">
              <button type="button" className="choice" aria-pressed={draft.frequency === 'daily'} onClick={() => setDraft({ ...draft, frequency: 'daily' })}>
                Diário
              </button>
              <button type="button" className="choice" aria-pressed={draft.frequency === 'weekly'} onClick={() => setDraft({ ...draft, frequency: 'weekly', days: draft.days.length ? draft.days : [today.getDay()] })}>
                Semanal
              </button>
            </div>
          </div>
          {draft.frequency === 'weekly' ? <DayField value={draft.days} onChange={(days) => setDraft({ ...draft, days })} /> : null}
          <Field label="Horário do aviso">
            <TextInput type="time" value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} />
          </Field>
          <ToggleRow label="Avisar no tablet neste horário" checked={draft.notify} onChange={(notify) => setDraft({ ...draft, notify })} />
          <ToggleRow label="Essa atividade tem Pix recompensa?" hint="Só você marca o Pix como feito." checked={draft.pixEnabled} onChange={(pixEnabled) => setDraft({ ...draft, pixEnabled })} />
          {draft.pixEnabled ? (
            <>
              <Field label="Valor do Pix">
                <TextInput inputMode="decimal" value={String(draft.pixAmount)} onChange={(event) => setDraft({ ...draft, pixAmount: Number(event.target.value.replace(',', '.')) || 0 })} />
              </Field>
              <Field label="Recadinho do Pix">
                <TextInput value={draft.pixNote} maxLength={80} placeholder="Pix da leitura" onChange={(event) => setDraft({ ...draft, pixNote: event.target.value })} />
              </Field>
            </>
          ) : null}
          {error ? <p className="text-sm font-bold text-rose-500">{error}</p> : null}
        </FormModal>
      ) : null}
      {removing ? <ConfirmRemove title={removing.title} onClose={() => setRemoveId(null)} onConfirm={() => { removeActivity(removing.id); setRemoveId(null) }} /> : null}
    </div>
  )
}

export function MealScreen() {
  const { state, role, today, saveMeal, removeMeal } = useRoutine()
  const check = useCheck()
  const [draft, setDraft] = useState<MealItem | null>(null)
  const [error, setError] = useState('')
  const [removeId, setRemoveId] = useState<string | null>(null)
  const day = dateKey(today)
  const visible = role === 'parent' ? state.meals : state.meals.filter((item) => occursOn(item.days, today))
  const removing = state.meals.find((item) => item.id === removeId)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!draft?.title.trim() || !draft.time) {
      setError('Escreva a refeição e o horário.')
      return
    }
    saveMeal({ ...draft, title: draft.title.trim(), note: draft.note.trim(), days: draft.days.length ? draft.days : ALL_DAYS })
    setDraft(null)
  }

  const seed = () => {
    const presets = [
      ['Café da manhã', '🥐', '07:00'],
      ['Lanche da manhã', '🍎', '09:30'],
      ['Almoço', '🍲', '12:00'],
      ['Lanche da tarde', '🍪', '15:30'],
      ['Jantar', '🥗', '19:00'],
    ] as const
    for (const [title, emoji, time] of presets) saveMeal({ id: uid(), title, emoji, time, note: '', days: ALL_DAYS })
  }

  return (
    <div>
      <PageHeader
        title="Refeições"
        text={role === 'parent' ? 'Cadastre o que ela come ao longo do dia.' : 'Marque quando terminar de comer.'}
        action={role === 'parent' ? <AddButton label="Nova refeição" onClick={() => { setError(''); setDraft({ id: uid(), title: '', emoji: '🍎', time: '12:00', note: '', days: ALL_DAYS }) }} /> : null}
      />
      {visible.length === 0 ? (
        <EmptyState
          emoji="🍎"
          title="Nenhuma refeição"
          text={role === 'parent' ? 'Você pode começar com o café, o almoço e o jantar.' : 'A mamãe ainda vai colocar as refeições.'}
          action={role === 'parent' ? <button type="button" className="btn-primary" onClick={seed}>Colocar as refeições do dia</button> : null}
        />
      ) : (
        <div className="grid gap-3">
          {visible.map((item) => {
            const done = Boolean(state.done[doneKey('meal', item.id, day)])
            return (
              <ItemCard
                key={item.id}
                emoji={item.emoji}
                title={item.title}
                meta={`${item.time} · ${daysLabel(item.days)}`}
                done={occursOn(item.days, today) ? done : undefined}
                canToggle={occursOn(item.days, today)}
                onToggle={() => check('meal', item.id, done)}
                onEdit={role === 'parent' ? () => { setError(''); setDraft(item) } : undefined}
                onDelete={role === 'parent' ? () => setRemoveId(item.id) : undefined}
                extra={item.note ? <p className="mt-1 text-sm">{item.note}</p> : null}
              />
            )
          })}
        </div>
      )}
      {draft ? (
        <FormModal title={state.meals.some((item) => item.id === draft.id) ? 'Editar refeição' : 'Nova refeição'} onClose={() => setDraft(null)} onSubmit={submit}>
          <EmojiField value={draft.emoji} onChange={(emoji) => setDraft({ ...draft, emoji })} />
          <Field label="Refeição">
            <TextInput value={draft.title} maxLength={60} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          </Field>
          <Field label="Horário">
            <TextInput type="time" value={draft.time} onChange={(event) => setDraft({ ...draft, time: event.target.value })} />
          </Field>
          <Field label="Recado">
            <TextInput value={draft.note} maxLength={180} onChange={(event) => setDraft({ ...draft, note: event.target.value })} />
          </Field>
          <DayField value={draft.days} onChange={(days) => setDraft({ ...draft, days })} />
          {error ? <p className="text-sm font-bold text-rose-500">{error}</p> : null}
        </FormModal>
      ) : null}
      {removing ? <ConfirmRemove title={removing.title} onClose={() => setRemoveId(null)} onConfirm={() => { removeMeal(removing.id); setRemoveId(null) }} /> : null}
    </div>
  )
}

export function GradeScreen() {
  const { state, role, today, saveGrade, removeGrade } = useRoutine()
  const [draft, setDraft] = useState<GradeItem | null>(null)
  const [error, setError] = useState('')
  const [removeId, setRemoveId] = useState<string | null>(null)
  const grades = [...state.grades].sort((a, b) => b.date.localeCompare(a.date))
  const removing = state.grades.find((item) => item.id === removeId)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!draft?.title.trim() || !draft.date) {
      setError('Escreva a prova e o dia.')
      return
    }
    if (draft.max <= 0) {
      setError('A nota máxima precisa ser maior que zero.')
      return
    }
    saveGrade({ ...draft, title: draft.title.trim(), score: Math.min(draft.score, draft.max) })
    setDraft(null)
  }

  return (
    <div>
      <PageHeader
        title="Notas"
        text={role === 'parent' ? 'Guarde as notas para ela acompanhar.' : 'Olha só como você foi bem.'}
        action={role === 'parent' ? <AddButton label="Nova nota" onClick={() => { setError(''); setDraft({ id: uid(), subject: 'Matemática', title: '', score: 10, max: 10, date: dateKey(today) }) }} /> : null}
      />
      {grades.length === 0 ? (
        <EmptyState emoji="🌈" title="Nenhuma nota ainda" text={role === 'parent' ? 'Registre a primeira prova ou trabalho.' : 'As notas vão aparecer aqui.'} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {grades.map((grade) => {
            const filled = Math.round((grade.score / grade.max) * 5)
            return (
              <article key={grade.id} className="card px-5 py-5">
                <p className="text-sm font-extrabold text-[var(--soft)]">{grade.subject} · {formatShort(grade.date)}</p>
                <h3 className="font-display mt-1 text-2xl">{grade.title}</h3>
                <p className="font-display mt-3 text-5xl text-fuchsia-500">
                  {grade.score.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
                  <span className="text-2xl text-[var(--soft)]"> / {grade.max.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</span>
                </p>
                <p className="mt-2 text-xl tracking-wide text-amber-400" aria-hidden="true">{'★'.repeat(filled)}{'☆'.repeat(5 - filled)}</p>
                {role === 'parent' ? (
                  <div className="mt-3 flex gap-2">
                    <button type="button" className="text-sm font-extrabold text-[var(--soft)]" onClick={() => { setError(''); setDraft(grade) }}>Editar</button>
                    <button type="button" className="text-sm font-extrabold text-rose-500" onClick={() => setRemoveId(grade.id)}>Apagar</button>
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      )}
      {draft ? (
        <FormModal title={state.grades.some((item) => item.id === draft.id) ? 'Editar nota' : 'Nova nota'} onClose={() => setDraft(null)} onSubmit={submit}>
          <Field label="Matéria">
            <select className="field-input" value={draft.subject} onChange={(event) => setDraft({ ...draft, subject: event.target.value })}>
              {SUBJECTS.map((subject) => <option key={subject}>{subject}</option>)}
            </select>
          </Field>
          <Field label="Prova ou trabalho">
            <TextInput value={draft.title} maxLength={80} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nota">
              <TextInput inputMode="decimal" value={String(draft.score)} onChange={(event) => setDraft({ ...draft, score: Number(event.target.value.replace(',', '.')) || 0 })} />
            </Field>
            <Field label="Máxima">
              <TextInput inputMode="decimal" value={String(draft.max)} onChange={(event) => setDraft({ ...draft, max: Number(event.target.value.replace(',', '.')) || 0 })} />
            </Field>
          </div>
          <Field label="Dia">
            <TextInput type="date" value={draft.date} onChange={(event) => setDraft({ ...draft, date: event.target.value })} />
          </Field>
          {error ? <p className="text-sm font-bold text-rose-500">{error}</p> : null}
        </FormModal>
      ) : null}
      {removing ? <ConfirmRemove title={removing.title} onClose={() => setRemoveId(null)} onConfirm={() => { removeGrade(removing.id); setRemoveId(null) }} /> : null}
    </div>
  )
}

export function PixScreen() {
  const { state, role, today, markPix, notify } = useRoutine()
  const todayIso = dateKey(today)
  const rows = recentDates(7, today).flatMap((day) => {
    const date = atDate(day)
    return state.activities.filter((item) => item.pixEnabled && activityOccurs(item, date)).map((activity) => ({
      activity,
      day,
      done: Boolean(state.done[doneKey('activity', activity.id, day)]),
      paid: state.pixPaid[pixKey(activity.id, day)],
    }))
  }).filter((row) => row.day === todayIso || row.done || row.paid)
  const month = dateKey(today).slice(0, 7)
  const sent = Object.entries(state.pixPaid)
    .filter(([key]) => key.slice(-10).startsWith(month))
    .reduce((sum, [, stamp]) => sum + stamp.amount, 0)

  return (
    <div>
      <PageHeader
        title="Pix recompensa"
        text={role === 'parent' ? 'O Pix fica dentro da atividade. Ela marca a atividade; você marca o Pix como feito.' : 'Quando você termina, a mamãe envia o Pix.'}
      />
      <section className="card mb-4 px-6 py-5">
        <p className="text-sm font-extrabold text-[var(--soft)]">Pix enviado neste mês</p>
        <p className="font-display text-4xl text-fuchsia-500">{money(sent)}</p>
      </section>
      {state.activities.every((item) => !item.pixEnabled) ? (
        <EmptyState emoji="💖" title="Nenhum Pix ainda" text={role === 'parent' ? 'Abra uma atividade e marque “Essa atividade tem Pix recompensa?”.' : 'A mamãe ainda não colocou um Pix nas atividades.'} />
      ) : rows.length === 0 ? (
        <EmptyState emoji="💖" title="Nada nesta semana" text="Os Pix dos próximos dias aparecem quando a atividade chegar." />
      ) : (
        <div className="grid gap-3">
          {rows.map((row) => (
            <article key={`${row.activity.id}-${row.day}`} className="card px-5 py-4">
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-4xl">{row.activity.emoji}</span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-2xl">{row.activity.title}</h3>
                  <p className="text-sm font-bold text-[var(--soft)]">
                    {formatShort(row.day)} · {money(row.activity.pixAmount)}
                    {row.activity.pixNote ? ` · ${row.activity.pixNote}` : ''}
                  </p>
                  <p className="mt-1 text-sm font-extrabold">
                    {row.paid ? 'Pix enviado!' : row.done ? 'Você conseguiu. O Pix está esperando a mamãe.' : 'Ainda falta marcar a atividade como feita.'}
                  </p>
                </div>
                {role === 'parent' ? (
                  <button
                    type="button"
                    className={row.paid ? 'btn-soft' : 'btn-primary'}
                    disabled={!row.done && !row.paid}
                    onClick={() => {
                      if (!row.done && !row.paid) {
                        notify('Ela ainda não marcou esta atividade')
                        return
                      }
                      markPix(row.activity.id, row.day)
                      if (!row.paid) playPop()
                    }}
                  >
                    {row.paid ? 'Desfazer Pix' : 'Marcar Pix como feito'}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
