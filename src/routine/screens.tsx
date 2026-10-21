import { useState, type FormEvent, type ReactNode } from 'react'
import {
  activityOccurs,
  ALL_DAYS,
  dailyJoke,
  dateKey,
  daysLabel,
  doneKey,
  formatLong,
  formatShort,
  frequencyLabel,
  homeworkKey,
  isSwimWeek,
  money,
  occursOn,
  pixKey,
  recentDates,
  schoolDaysOfWeek,
  schoolOccurs,
  shiftSchoolWeek,
  SCHOOL_DAYS,
  SUBJECTS,
  todayTasks,
  uid,
  type ActivityItem,
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

function CreateAlarmButton({ kind }: { kind: 'activity' | 'meal' | 'homework' }) {
  const { state, saveAlarm, notify } = useRoutine()
  const [open, setOpen] = useState(false)
  const [sourceId, setSourceId] = useState('')
  const [time, setTime] = useState('16:00')
  const [days, setDays] = useState<number[]>(SCHOOL_DAYS)
  const [error, setError] = useState('')
  const choices = kind === 'activity' ? state.activities : kind === 'meal' ? state.meals : state.homework
  const picked = choices.find((item) => item.id === sourceId)

  const fill = (id: string) => {
    setSourceId(id)
    if (kind === 'activity') {
      const item = state.activities.find((choice) => choice.id === id)
      if (!item) return
      setTime(item.time)
      setDays(item.frequency === 'daily' ? ALL_DAYS : item.days)
    }
    if (kind === 'meal') {
      const item = state.meals.find((choice) => choice.id === id)
      if (!item) return
      setTime(item.time)
      setDays(item.days)
    }
    if (kind === 'homework') {
      const item = state.homework.find((choice) => choice.id === id)
      if (!item) return
      setDays([atDate(item.due).getDay()])
    }
  }

  const start = () => {
    setError('')
    const first = choices[0]
    setTime(first && 'time' in first ? first.time : '16:00')
    setDays(SCHOOL_DAYS)
    setSourceId('')
    if (first) fill(first.id)
    setOpen(true)
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!picked) {
      setError(kind === 'meal' ? 'Cadastre uma refeição primeiro.' : kind === 'homework' ? 'Cadastre uma lição primeiro.' : 'Cadastre uma atividade primeiro.')
      return
    }
    if (!time || days.length === 0) {
      setError('Escolha o horário e pelo menos um dia.')
      return
    }
    saveAlarm({
      id: `wake-${kind}-${picked.id}`,
      label: picked.title,
      emoji: picked.emoji,
      time,
      days,
      enabled: true,
      on: kind === 'homework' && 'due' in picked ? picked.due : '',
    })
    void askNotificationPermission()
    notify('Despertador criado')
    setOpen(false)
  }

  return (
    <>
      <button type="button" className="btn-soft" onClick={start}>
        Criar despertador
      </button>
      {open ? (
        <FormModal title="Criar despertador" onClose={() => setOpen(false)} onSubmit={submit} submitLabel="Criar">
          <Field label={kind === 'meal' ? 'Refeição' : kind === 'homework' ? 'Lição' : 'Atividade'}>
            <select className="field-input" value={sourceId} onChange={(event) => fill(event.target.value)}>
              {choices.length === 0 ? <option value="">Nenhuma ainda</option> : null}
              {choices.map((item) => (
                <option key={item.id} value={item.id}>{item.emoji} {item.title}</option>
              ))}
            </select>
          </Field>
          <Field label="Horário">
            <TextInput type="time" value={time} onChange={(event) => setTime(event.target.value)} />
          </Field>
          {kind === 'homework' && picked && 'due' in picked ? (
            <p className="text-sm font-bold text-[var(--soft)]">Toca no dia da entrega, {formatShort(picked.due)}.</p>
          ) : (
            <DayField value={days} onChange={setDays} />
          )}
          {error ? <p className="text-sm font-bold text-rose-500">{error}</p> : null}
        </FormModal>
      ) : null}
    </>
  )
}

export function TodayScreen() {
  const { state, today } = useRoutine()
  const check = useCheck()
  const [showAnswer, setShowAnswer] = useState(false)
  const day = dateKey(today)
  const tasks = todayTasks(state, today)
  const homeworkCards = state.homework.filter((item) => item.due <= day && (!state.done[homeworkKey(item.id)] || item.due === day)).map((item) => ({
    kind: 'homework' as const,
    id: item.id,
    emoji: item.emoji,
    title: item.title,
    time: item.due === day ? 'Para hoje' : 'Atrasada',
    done: Boolean(state.done[homeworkKey(item.id)]),
    pix: false,
  }))
  const all = [...tasks, ...homeworkCards]
  const pending = all.filter((item) => !item.done)
  const finished = all.filter((item) => item.done)
  const routine = state.school.filter((item) => schoolOccurs(item, today)).sort((a, b) => a.start.localeCompare(b.start))
  const materials = routine.filter((item) => item.materials.trim())
  const exam = routine.some((item) => item.title.toLocaleLowerCase('pt-BR').includes('avalia'))
  const joke = dailyJoke(today)
  const profile = state.profile
  const card = (task: (typeof all)[number]) => (
    <ItemCard
      key={`${task.kind}-${task.id}`}
      emoji={task.emoji}
      title={task.title}
      meta={[task.time, task.kind === 'meal' ? 'Refeição' : task.kind === 'homework' ? 'Lição' : 'Atividade', task.pix ? 'Tem Pix' : ''].filter(Boolean).join(' · ')}
      done={task.done}
      canToggle
      onToggle={() => check(task.kind, task.id, task.done)}
    />
  )

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="card px-6 py-6 lg:col-span-2">
        <p className="text-sm font-extrabold tracking-wide text-[var(--soft)] uppercase">{formatLong(today)}</p>
        <h1 className="font-display mt-1 text-4xl md:text-5xl">Oi, {profile?.name}!</h1>
        <p className="mt-2 text-[var(--soft)]">{pending.length === 0 ? 'Nada pendente por aqui.' : `Ainda ${pending.length === 1 ? 'falta' : 'faltam'} ${pending.length} · ${finished.length} ${finished.length === 1 ? 'feita' : 'feitas'}`}</p>
      </section>

      {exam ? (
        <section className="rounded-[1.75rem] px-6 py-6 text-center shadow-lg lg:col-span-2" style={{ background: 'linear-gradient(135deg, #fbcfe8, #ddd6fe)' }}>
          <p className="text-4xl">🌟</p>
          <h2 className="font-display mt-2 text-4xl">Boa sorte, Laurinha!</h2>
          <p className="mt-1 font-extrabold">Hoje tem prova. Você consegue.</p>
        </section>
      ) : null}

      <section className="card px-6 py-5">
        <h2 className="font-display text-2xl">Ainda falta fazer</h2>
        {pending.length === 0 ? (
          <p className="mt-3 text-[var(--soft)]">Tudo de hoje já foi feito.</p>
        ) : (
          <div className="mt-3 grid gap-3">{pending.map(card)}</div>
        )}
      </section>

      <section className="card px-6 py-5">
        <h2 className="font-display text-2xl">Feitas</h2>
        {finished.length === 0 ? (
          <p className="mt-3 text-[var(--soft)]">Quando terminar, elas aparecem aqui.</p>
        ) : (
          <div className="mt-3 grid gap-3">{finished.map(card)}</div>
        )}
      </section>

      <section className="card px-6 py-5">
        <h2 className="font-display text-2xl">Rotina do dia</h2>
        {routine.length === 0 ? (
          <p className="mt-3 text-[var(--soft)]">Hoje não tem aula no cronograma.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {routine.map((item) => (
              <li key={item.id} className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2">
                <span className="text-2xl">{item.emoji}</span>
                <span>
                  <span className="block font-extrabold">{item.title}</span>
                  <span className="text-sm font-bold text-[var(--soft)]">{item.end ? `${item.start} – ${item.end}` : item.start}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card px-6 py-5">
        <h2 className="font-display text-2xl">Arrume o material</h2>
        <p className="mt-1 text-sm font-bold text-[var(--soft)]">Antes de sair, confira a mochila.</p>
        {materials.length === 0 ? (
          <p className="mt-3 text-[var(--soft)]">Nada extra para levar hoje.</p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {materials.map((item) => (
              <li key={item.id} className="rounded-2xl bg-white px-3 py-2">
                <span className="block font-extrabold">{item.emoji} {item.title}</span>
                <span className="text-sm text-[var(--soft)]">{item.materials}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card px-6 py-5 lg:col-span-2">
        <h2 className="font-display text-2xl">Piada do dia</h2>
        <p className="mt-3 text-lg font-extrabold">{joke.ask}</p>
        {showAnswer ? (
          <p className="mt-2 text-lg">{joke.answer}</p>
        ) : (
          <button type="button" className="btn-soft mt-3" onClick={() => setShowAnswer(true)}>
            Ver a resposta
          </button>
        )}
      </section>
    </div>
  )
}

const POSTER_ROWS = ['early', 'mid', 'lunch', 'gap', 'after', 'late'] as const

function posterBands(item: SchoolItem) {
  if (item.start <= '13:00') return item.end > '13:50' ? ['early', 'mid'] : ['early']
  if (item.start < '14:40') return ['mid']
  if (item.start < '16:00') return ['lunch']
  if (item.start < '17:00') return ['after']
  return ['late']
}

function posterClock(value: string) {
  const [hour, minute] = value.split(':')
  return `${Number(hour)}h${minute}`
}

function posterTime(item: SchoolItem, band: string) {
  if (band === 'early' && item.end > '13:50') return '13h00 às 13h50'
  if (band === 'mid' && item.start < '13:50') return '13h50 às 14h40'
  return item.end ? `${posterClock(item.start)} às ${posterClock(item.end)}` : posterClock(item.start)
}

function posterTone(title: string) {
  const name = title.toLocaleLowerCase('pt-BR')
  if (name.includes('lanche')) return { background: '#fff7fb', color: '#e11d48' }
  if (name.includes('nata')) return { background: '#2dd4bf', color: '#134e4a' }
  if (name.includes('laborat')) return { background: '#4ade80', color: '#14532d' }
  if (name.includes('linguag') || name.includes('ciên') || name.includes('cien')) return { background: '#3b82f6', color: '#ffffff' }
  if (name.includes('ingl')) return { background: '#e879f9', color: '#4a044e' }
  if (name.includes('brincar')) return { background: '#5eead4', color: '#134e4a' }
  if (name.includes('parque')) return { background: '#fde047', color: '#713f12' }
  if (name.includes('físic') || name.includes('fisic')) return { background: '#38bdf8', color: '#0c4a6e' }
  if (name.includes('arte')) return { background: '#d8b4fe', color: '#581c87' }
  if (name.includes('rob') || name.includes('karat') || name.includes('danç') || name.includes('danc')) return { background: '#fb923c', color: '#7c2d12' }
  if (name.includes('biblioteca')) return { background: '#bef264', color: '#365314' }
  if (name.includes('brinquedo')) return { background: '#fb7185', color: '#ffffff' }
  return { background: '#f9a8d4', color: '#831843' }
}

export function SchoolScreen() {
  const { state, role, today, saveSchool, removeSchool } = useRoutine()
  const [draft, setDraft] = useState<SchoolItem | null>(null)
  const [error, setError] = useState('')
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [selected, setSelected] = useState(() => {
    const weekday = today.getDay()
    if (weekday >= 1 && weekday <= 5) return new Date(today.getFullYear(), today.getMonth(), today.getDate())
    return schoolDaysOfWeek(today)[0]
  })
  const week = schoolDaysOfWeek(selected)
  const materials = state.school.filter((item) => schoolOccurs(item, selected) && item.materials.trim()).sort((a, b) => a.start.localeCompare(b.start))
  const removing = state.school.find((item) => item.id === removeId)
  const earlier = shiftSchoolWeek(selected, -1)
  const later = shiftSchoolWeek(selected, 1)
  const openNew = () => {
    setError('')
    setDraft({ id: uid(), title: '', emoji: '🎒', start: '13:00', end: '13:50', days: [selected.getDay()], week: 'all', until: '', materials: '' })
  }

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
    saveSchool({ ...draft, title: draft.title.trim(), materials: draft.materials.trim(), days: draft.days.length ? draft.days : SCHOOL_DAYS })
    setDraft(null)
  }

  return (
    <div>
      <div className="mb-4 text-center">
        <h1 className="font-display text-4xl tracking-tight sm:text-5xl">Cronograma semanal</h1>
        <p className="mt-1 font-extrabold">Professora Marcela · 2º ano E</p>
        <p className="mt-1 text-sm font-bold text-[var(--soft)]">Até 15 de dezembro. Toque no dia para ver o material.</p>
      </div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <button type="button" aria-label="Semana anterior" className="btn-ghost grid h-11 w-11 place-items-center text-2xl" disabled={dateKey(earlier) === dateKey(selected)} onClick={() => setSelected(earlier)}>
          ‹
        </button>
        <p className="text-center text-sm font-extrabold">{isSwimWeek(selected) ? 'Semana da natação' : 'Semana da robótica'}</p>
        <button type="button" aria-label="Próxima semana" className="btn-ghost grid h-11 w-11 place-items-center text-2xl" disabled={dateKey(later) === dateKey(selected)} onClick={() => setSelected(later)}>
          ›
        </button>
      </div>
      {role === 'parent' ? (
        <div className="mb-3 flex justify-end">
          <AddButton label="Nova aula" onClick={openNew} />
        </div>
      ) : null}
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
        {week.map((date) => {
          const key = dateKey(date)
          const active = key === dateKey(selected)
          const isToday = key === dateKey(today)
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => setSelected(date)}
              className={`rounded-xl border-2 border-[#2b2b2b] px-1 py-2 text-center ${active ? 'bg-[#f9a8d4]' : 'bg-white'}`}
            >
              <span className="block font-display text-[11px] leading-none sm:text-base">{['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'][date.getDay()]}</span>
              <span className="mt-1 block text-[10px] font-extrabold sm:text-xs">{isToday ? 'Hoje' : date.getDate()}</span>
            </button>
          )
        })}
        {POSTER_ROWS.map((row) => week.map((date) => {
          const item = state.school.find((lesson) => schoolOccurs(lesson, date) && posterBands(lesson).includes(row))
          const key = `${row}-${dateKey(date)}`
          if (!item) {
            return <div key={key} className={`rounded-xl border-2 border-[#2b2b2b] bg-white ${row === 'gap' ? 'min-h-8 sm:min-h-10' : 'min-h-16 sm:min-h-20'}`} />
          }
          const tone = posterTone(item.title)
          const label = item.title.toLocaleLowerCase('pt-BR').includes('lanche') ? 'Lanche' : item.title
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                setSelected(date)
                if (role === 'parent') {
                  setError('')
                  setDraft(item)
                }
              }}
              className="flex min-h-16 flex-col items-center justify-center rounded-xl border-2 border-[#2b2b2b] px-1 py-1.5 text-center sm:min-h-20 sm:px-2"
              style={tone}
            >
              <span className="font-display text-[10px] leading-tight sm:text-sm">{label}</span>
              <span className="mt-1 text-[8px] font-extrabold uppercase sm:text-[11px]">{posterTime(item, row)}</span>
            </button>
          )
        }))}
      </div>
      <p className="mt-4 rounded-2xl bg-[#fbcfe8] px-4 py-3 text-center text-xs font-bold leading-relaxed sm:text-sm">
        Robótica, Laboratório de Ciências, Natação, Dança e Karatê acontecem quinzenalmente. O cronograma pode mudar.
      </p>
      <section className="card mt-4 px-6 py-5">
        <p className="text-sm font-extrabold tracking-wide text-[var(--soft)] uppercase">Material do dia</p>
        <h2 className="font-display mt-1 text-2xl">{formatLong(selected)}</h2>
        {materials.length === 0 ? (
          <p className="mt-3 text-[var(--soft)]">{role === 'parent' ? 'Toque numa aula para escrever o que vai na mochila.' : 'Nada extra para levar neste dia.'}</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {materials.map((item) => (
              <li key={item.id} className="flex items-start gap-3">
                <span className="text-2xl">{item.emoji}</span>
                <span>
                  <span className="block font-extrabold">{item.title}</span>
                  <span className="text-[var(--soft)]">{item.materials}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {draft ? (
        <FormModal title={state.school.some((item) => item.id === draft.id) ? 'Editar aula' : 'Nova aula'} onClose={() => setDraft(null)} onSubmit={submit}>
          <EmojiField value={draft.emoji} onChange={(emoji) => setDraft({ ...draft, emoji })} />
          <Field label="Nome">
            <TextInput value={draft.title} maxLength={60} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          </Field>
          <Field label="Material da mochila">
            <TextInput value={draft.materials} maxLength={120} placeholder="O que ela leva neste dia" onChange={(event) => setDraft({ ...draft, materials: event.target.value })} />
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
          {state.school.some((item) => item.id === draft.id) ? (
            <button type="button" className="justify-self-start text-sm font-extrabold text-rose-500" onClick={() => { setRemoveId(draft.id); setDraft(null) }}>
              Apagar esta aula
            </button>
          ) : null}
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
        action={<div className="flex flex-wrap gap-2">{role === 'parent' ? <AddButton label="Nova lição" onClick={() => { setError(''); setDraft({ id: uid(), subject: 'Matemática', title: '', due: todayIso, note: '', emoji: '✏️' }) }} /> : null}<CreateAlarmButton kind="homework" /></div>}
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
        action={<div className="flex flex-wrap gap-2">{role === 'parent' ? <AddButton label="Nova atividade" onClick={() => { setError(''); setDraft({ id: uid(), title: '', emoji: '⭐', note: '', frequency: 'daily', days: SCHOOL_DAYS, time: '16:00', notify: true, pixEnabled: false, pixAmount: 5, pixNote: '' }) }} /> : null}<CreateAlarmButton kind="activity" /></div>}
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
        action={<div className="flex flex-wrap gap-2">{role === 'parent' ? <AddButton label="Nova refeição" onClick={() => { setError(''); setDraft({ id: uid(), title: '', emoji: '🍎', time: '12:00', note: '', days: ALL_DAYS }) }} /> : null}<CreateAlarmButton kind="meal" /></div>}
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
