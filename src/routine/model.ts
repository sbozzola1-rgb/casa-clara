export type AvatarLook = {
  skin: number
  hair: number
  hairColor: number
  eyes: number
  outfit: number
  accessory: number
  background: number
  portrait: number
  make: number
}

export type Profile = {
  name: string
  avatar: AvatarLook
  pin: string
  recovery: string
}

export type SchoolWeek = 'all' | 'swim' | 'robot'

export type SchoolItem = {
  id: string
  title: string
  emoji: string
  start: string
  end: string
  days: number[]
  week: SchoolWeek
  until: string
  materials: string
}

export type HomeworkItem = {
  id: string
  subject: string
  title: string
  due: string
  note: string
  emoji: string
}

export type AlarmItem = {
  id: string
  label: string
  emoji: string
  time: string
  days: number[]
  enabled: boolean
  on: string
}

export type ActivityItem = {
  id: string
  title: string
  emoji: string
  note: string
  frequency: 'daily' | 'weekly'
  days: number[]
  time: string
  notify: boolean
  pixEnabled: boolean
  pixAmount: number
  pixNote: string
}

export type MealItem = {
  id: string
  title: string
  emoji: string
  time: string
  note: string
  days: number[]
}

export type GradeItem = {
  id: string
  subject: string
  title: string
  score: number
  max: number
  date: string
}

export type DoneStamp = { at: string }

export type RoutineState = {
  profile: Profile | null
  school: SchoolItem[]
  homework: HomeworkItem[]
  alarms: AlarmItem[]
  activities: ActivityItem[]
  meals: MealItem[]
  grades: GradeItem[]
  done: Record<string, DoneStamp>
  pixPaid: Record<string, { at: string; amount: number }>
  rung: Record<string, true>
  notified: Record<string, true>
}

export type TabId = 'hoje' | 'escola' | 'licao' | 'atividades' | 'refeicoes' | 'notas' | 'pix'

export const TABS: { id: TabId; label: string; emoji: string }[] = [
  { id: 'hoje', label: 'Hoje', emoji: '🌸' },
  { id: 'escola', label: 'Escola', emoji: '🎒' },
  { id: 'licao', label: 'Lição', emoji: '✏️' },
  { id: 'atividades', label: 'Atividades', emoji: '⭐' },
  { id: 'refeicoes', label: 'Refeições', emoji: '🍎' },
  { id: 'notas', label: 'Notas', emoji: '🌈' },
  { id: 'pix', label: 'Pix', emoji: '💖' },
]

export const WEEKDAYS = [
  { id: 0, short: 'D', name: 'Dom' },
  { id: 1, short: 'S', name: 'Seg' },
  { id: 2, short: 'T', name: 'Ter' },
  { id: 3, short: 'Q', name: 'Qua' },
  { id: 4, short: 'Q', name: 'Qui' },
  { id: 5, short: 'S', name: 'Sex' },
  { id: 6, short: 'S', name: 'Sáb' },
]

export const SUBJECTS = ['Matemática', 'Português', 'Ciências', 'História', 'Geografia', 'Inglês', 'Artes', 'Educação física', 'Outra']

export const EMOJI_CHOICES = ['📚', '✏️', '🎒', '🏫', '⭐', '🌈', '🖌️', '🔢', '🧪', '🌍', '🎶', '🏃', '🩰', '⚽', '🎹', '🪥', '🛏️', '🌙', '☀️', '🍎', '🥐', '🍲', '🥗', '🍪', '🥛', '💖', '🐰', '🦄', '🌸', '👑', '⏰', '💧']

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
export const SCHOOL_DAYS = [1, 2, 3, 4, 5]

const KEY = 'casa-clara.rotina.v1'

export function uid() {
  return crypto.randomUUID()
}

export function dateKey(date = new Date()) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatLong(date: Date) {
  const text = date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function formatShort(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
}

export function money(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function defaultAvatar(): AvatarLook {
  return { skin: 0, hair: 0, hairColor: 0, eyes: 0, outfit: 0, accessory: 0, background: 0, portrait: 0, make: 0 }
}

export function emptyRoutine(): RoutineState {
  return {
    profile: null,
    school: lauraSchool(),
    homework: [],
    alarms: [],
    activities: [],
    meals: [],
    grades: [],
    done: {},
    pixPaid: {},
    rung: {},
    notified: {},
  }
}

export function doneKey(kind: 'school' | 'activity' | 'meal', id: string, date: string) {
  return `${kind}:${id}:${date}`
}

export function homeworkKey(id: string) {
  return `homework:${id}`
}

export function pixKey(id: string, date: string) {
  return `pix:${id}:${date}`
}

export function eventKey(kind: 'alarm' | 'activity', id: string, date: string) {
  return `${kind}:${id}:${date}`
}

export function occursOn(days: number[], date: Date) {
  if (days.length === 0) return true
  return days.includes(date.getDay())
}

const SWIM_MONDAY = new Date(2026, 9, 19)

function mondayOf(date: Date) {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const weekday = day.getDay()
  day.setDate(day.getDate() + (weekday === 0 ? -6 : 1 - weekday))
  return day
}

export function isSwimWeek(date: Date) {
  const days = Math.round((mondayOf(date).getTime() - SWIM_MONDAY.getTime()) / 86_400_000)
  return Math.floor(days / 7) % 2 === 0
}

export function schoolOccurs(item: SchoolItem, date: Date) {
  if (!occursOn(item.days, date)) return false
  const key = dateKey(date)
  if (item.until && key > item.until) return false
  if (item.week === 'swim') return isSwimWeek(date)
  if (item.week === 'robot') return !isSwimWeek(date)
  return true
}

export function weekLabel(week: SchoolWeek) {
  if (week === 'swim') return 'Semana da natação'
  if (week === 'robot') return 'Semana da robótica'
  return ''
}

const TERM_START = new Date(2026, 9, 19)
const TERM_LAST = new Date(2026, 11, 15)

export function schoolDaysOfWeek(date: Date) {
  const monday = mondayOf(date)
  return Array.from({ length: 5 }, (_, index) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + index)
    return day
  })
}

export function shiftSchoolWeek(date: Date, direction: -1 | 1) {
  const weekday = date.getDay()
  const nextMonday = mondayOf(date)
  nextMonday.setDate(nextMonday.getDate() + direction * 7)
  if (nextMonday < mondayOf(TERM_START) || nextMonday > mondayOf(TERM_LAST)) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
  }
  const next = new Date(nextMonday)
  next.setDate(nextMonday.getDate() + (weekday >= 1 && weekday <= 5 ? weekday - 1 : 0))
  return next
}

const TERM_END = '2026-12-15'

function lesson(id: string, title: string, emoji: string, start: string, end: string, days: number[], week: SchoolWeek, materials = ''): SchoolItem {
  return { id, title, emoji, start, end, days, week, until: TERM_END, materials }
}

export function lauraSchool(): SchoolItem[] {
  return [
    lesson('laura-lanche', 'Lanche', '🍎', '14:50', '15:10', SCHOOL_DAYS, 'all'),
    lesson('laura-seg-parque', 'Parque', '🌳', '16:40', '17:00', [1], 'all'),
    lesson('laura-seg-ingles', 'Inglês', '💬', '17:10', '18:00', [1], 'all'),
    lesson('laura-ter-edfisica', 'Educação física', '🏃', '16:20', '17:10', [2], 'all', 'Tênis'),
    lesson('laura-qua-ingles', 'Inglês', '💬', '13:50', '14:40', [3], 'all'),
    lesson('laura-qua-arte', 'Arte', '🎨', '16:20', '17:10', [3], 'all'),
    lesson('laura-sex-brinquedo', 'Dia do brinquedo', '🧸', '17:10', '18:00', [5], 'all', 'Um brinquedo'),
    lesson('laura-ter-natacao', 'Natação', '🏊', '13:00', '13:50', [2], 'swim', 'Maiô, touca e óculos'),
    lesson('laura-qua-linguagens', 'Avaliação de linguagens', '📝', '13:00', '13:50', [3], 'swim'),
    lesson('laura-qui-brincar', 'Brincar', '🎈', '13:50', '14:40', [4], 'swim'),
    lesson('laura-sex-lab', 'Laboratório de ciências', '🔬', '13:50', '14:40', [5], 'swim'),
    lesson('laura-sex-parque', 'Parque', '🌳', '16:40', '17:00', [5], 'swim'),
    lesson('laura-ter-robotica', 'Robótica', '🤖', '13:00', '14:40', [2], 'robot'),
    lesson('laura-qua-ciencias', 'Avaliação de ciências', '🧪', '13:00', '13:50', [3], 'robot'),
    lesson('laura-qui-biblioteca', 'Biblioteca', '📚', '13:50', '14:40', [4], 'robot'),
    lesson('laura-qui-parque', 'Parque', '🌳', '16:40', '17:00', [4], 'robot'),
    lesson('laura-sex-karate', 'Karatê / dança', '🥋', '16:20', '17:10', [5], 'robot', 'Roupa de karatê ou de dança'),
  ]
}

export function activityOccurs(item: ActivityItem, date: Date) {
  if (item.frequency === 'daily') return true
  return item.days.includes(date.getDay())
}

export function daysLabel(days: number[]) {
  const order = [...new Set(days)].filter((day) => day >= 0 && day <= 6).sort((a, b) => a - b)
  if (order.length === 7) return 'Todos os dias'
  if (order.length === 0) return 'Nenhum dia'
  if (order.join() === SCHOOL_DAYS.join()) return 'Dias de aula'
  return order.map((day) => WEEKDAYS[day]?.name ?? '').filter(Boolean).join(', ')
}

export function frequencyLabel(item: ActivityItem) {
  if (item.frequency === 'daily') return 'Todo dia'
  return daysLabel(item.days)
}

export function isDue(time: string, now: Date, windowMinutes = 15) {
  if (!/^\d{2}:\d{2}$/.test(time)) return false
  const [hour, minute] = time.split(':').map(Number)
  const target = hour * 60 + minute
  const current = now.getHours() * 60 + now.getMinutes()
  const delta = current - target
  return delta >= 0 && delta <= windowMinutes
}

export function alarmOnDay(alarm: AlarmItem, day: Date) {
  if (!alarm.enabled || !/^\d{2}:\d{2}$/.test(alarm.time) || alarm.days.length === 0) return false
  if (alarm.on && alarm.on !== dateKey(day)) return false
  return alarm.days.includes(day.getDay())
}

const JOKES: { ask: string; answer: string }[] = [
  { ask: 'Por que o livro de matemática ficou triste?', answer: 'Porque tinha muitos problemas.' },
  { ask: 'O que o zero disse para o oito?', answer: 'Que cinto bonito!' },
  { ask: 'Por que a planta não responde?', answer: 'Porque está ocupada, crescendo.' },
  { ask: 'Qual é o animal que não vale nada?', answer: 'O javali.' },
  { ask: 'O que a abelha fala quando chega em casa?', answer: 'Já mel!' },
  { ask: 'Por que o computador foi ao médico?', answer: 'Porque tinha um vírus.' },
  { ask: 'O que é um pontinho amarelo no céu?', answer: 'Um yellowcóptero.' },
  { ask: 'Por que a galinha atravessou a rua?', answer: 'Para chegar do outro lado.' },
  { ask: 'Qual é o rei dos queijos?', answer: 'O reiqueijão.' },
  { ask: 'O que a foca falou para a outra?', answer: 'O que é que foi?' },
  { ask: 'Por que a vassoura não dorme?', answer: 'Porque ela só sabe varrer.' },
  { ask: 'Qual é o cúmulo da força?', answer: 'Dobrar a esquina.' },
]

export function dailyJoke(date: Date) {
  const key = dateKey(date)
  const index = [...key].reduce((sum, char) => sum + char.charCodeAt(0), 0) % JOKES.length
  return JOKES[index]
}

export function nextAlarm(alarms: AlarmItem[], now: Date) {
  const enabled = alarms.filter((alarm) => alarm.enabled && /^\d{2}:\d{2}$/.test(alarm.time) && alarm.days.length > 0)
  let best: { alarm: AlarmItem; at: Date } | null = null
  for (let offset = 0; offset < 8; offset += 1) {
    const day = new Date(now)
    day.setDate(now.getDate() + offset)
    day.setSeconds(0, 0)
    for (const alarm of enabled) {
      if (!alarmOnDay(alarm, day)) continue
      const [hour, minute] = alarm.time.split(':').map(Number)
      const at = new Date(day)
      at.setHours(hour, minute, 0, 0)
      if (at.getTime() <= now.getTime()) continue
      if (!best || at.getTime() < best.at.getTime()) best = { alarm, at }
    }
  }
  return best
}

export function todayTasks(state: RoutineState, date: Date) {
  const key = dateKey(date)
  const tasks: { kind: 'activity' | 'meal'; id: string; emoji: string; title: string; time: string; done: boolean; pix: boolean }[] = []
  for (const item of state.activities) {
    if (!activityOccurs(item, date)) continue
    tasks.push({
      kind: 'activity',
      id: item.id,
      emoji: item.emoji,
      title: item.title,
      time: item.time,
      done: Boolean(state.done[doneKey('activity', item.id, key)]),
      pix: item.pixEnabled,
    })
  }
  for (const item of state.meals) {
    if (!occursOn(item.days, date)) continue
    tasks.push({
      kind: 'meal',
      id: item.id,
      emoji: item.emoji,
      title: item.title,
      time: item.time,
      done: Boolean(state.done[doneKey('meal', item.id, key)]),
      pix: false,
    })
  }
  return tasks.sort((a, b) => a.time.localeCompare(b.time) || a.title.localeCompare(b.title))
}

function text(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function days(value: unknown, fallback: number[]) {
  if (!Array.isArray(value)) return fallback
  const next = value.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
  return [...new Set(next)]
}

function clock(value: unknown, fallback: string) {
  const raw = text(value)
  return /^\d{2}:\d{2}$/.test(raw) ? raw : fallback
}

function emoji(value: unknown, fallback: string) {
  const raw = text(value).trim()
  return raw ? raw.slice(0, 8) : fallback
}

function amount(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(text(value).replace(',', '.'))
  if (!Number.isFinite(parsed) || parsed < 0) return 0
  return Math.round(parsed * 100) / 100
}

function stampMap(value: unknown): Record<string, DoneStamp> {
  if (!value || typeof value !== 'object') return {}
  const next: Record<string, DoneStamp> = {}
  for (const [key, stamp] of Object.entries(value)) {
    if (stamp && typeof stamp === 'object' && typeof (stamp as { at?: unknown }).at === 'string') next[key] = { at: (stamp as { at: string }).at }
  }
  return next
}

function flagMap(value: unknown): Record<string, true> {
  if (!value || typeof value !== 'object') return {}
  return Object.fromEntries(Object.keys(value).map((key) => [key, true as const]))
}

function pixMap(value: unknown): RoutineState['pixPaid'] {
  if (!value || typeof value !== 'object') return {}
  const next: RoutineState['pixPaid'] = {}
  for (const [key, stamp] of Object.entries(value)) {
    if (!stamp || typeof stamp !== 'object') continue
    const at = text((stamp as { at?: unknown }).at)
    if (!at) continue
    next[key] = { at, amount: amount((stamp as { amount?: unknown }).amount) }
  }
  return next
}

function avatar(value: unknown): AvatarLook {
  const base = defaultAvatar()
  if (!value || typeof value !== 'object') return base
  const source = value as Record<string, unknown>
  const pick = (key: keyof AvatarLook, max: number) => {
    const parsed = Number(source[key])
    return Number.isInteger(parsed) && parsed >= 0 && parsed <= max ? parsed : base[key]
  }
  const modern = Object.prototype.hasOwnProperty.call(source, 'make')
  const portrait = Number(source.portrait)
  const legacyHair = Number.isInteger(portrait) && portrait >= 0 && portrait <= 3 ? portrait : 0
  const hair = modern ? pick('hair', 3) : legacyHair
  return {
    skin: pick('skin', 5),
    hair,
    hairColor: pick('hairColor', 5),
    eyes: modern ? pick('eyes', 2) : 0,
    outfit: modern ? pick('outfit', 2) : 0,
    accessory: modern ? pick('accessory', 7) : 0,
    background: pick('background', 5),
    portrait: hair,
    make: pick('make', 2),
  }
}

export function sanitize(input: unknown): RoutineState {
  const empty = emptyRoutine()
  if (!input || typeof input !== 'object') return empty
  const source = input as Record<string, unknown>

  let profile: Profile | null = null
  if (source.profile && typeof source.profile === 'object') {
    const raw = source.profile as Record<string, unknown>
    const name = text(raw.name).trim().slice(0, 24)
    const pin = text(raw.pin).replace(/\D/g, '').slice(0, 4)
    if (name) profile = { name, avatar: avatar(raw.avatar), pin: pin.length === 4 ? pin : '', recovery: text(raw.recovery).trim().toLocaleLowerCase('pt-BR').slice(0, 24) }
  }

  const seededMaterials = new Map(lauraSchool().map((item) => [item.id, item.materials]))
  const school = Array.isArray(source.school)
    ? source.school.flatMap((item) => {
        if (!item || typeof item !== 'object' || typeof item.id !== 'string') return []
        const title = text(item.title).trim().slice(0, 60)
        if (!title) return []
        const week = item.week === 'swim' || item.week === 'robot' ? item.week : 'all'
        const until = /^\d{4}-\d{2}-\d{2}$/.test(text(item.until)) ? text(item.until) : ''
        const materials = typeof item.materials === 'string' ? text(item.materials).trim().slice(0, 120) : (seededMaterials.get(item.id) ?? '')
        return [{ id: item.id, title, emoji: emoji(item.emoji, '🎒'), start: clock(item.start, '07:30'), end: clock(item.end, ''), days: days(item.days, SCHOOL_DAYS), week, until, materials }]
      })
    : []
  const schoolPlan = school.length ? school : lauraSchool()

  const homework = Array.isArray(source.homework)
    ? source.homework.flatMap((item) => {
        if (!item || typeof item !== 'object' || typeof item.id !== 'string') return []
        const title = text(item.title).trim().slice(0, 80)
        const due = text(item.due)
        if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(due)) return []
        return [{ id: item.id, title, subject: text(item.subject).trim().slice(0, 40) || 'Outra', due, note: text(item.note).trim().slice(0, 180), emoji: emoji(item.emoji, '✏️') }]
      })
    : []

  const alarms = Array.isArray(source.alarms)
    ? source.alarms.flatMap((item) => {
        if (!item || typeof item !== 'object' || typeof item.id !== 'string') return []
        const label = text(item.label).trim().slice(0, 60)
        if (!label) return []
        const on = /^\d{4}-\d{2}-\d{2}$/.test(text(item.on)) ? text(item.on) : ''
        return [{ id: item.id, label, emoji: emoji(item.emoji, '⏰'), time: clock(item.time, '07:00'), days: days(item.days, ALL_DAYS), enabled: item.enabled !== false, on }]
      })
    : []

  const activities = Array.isArray(source.activities)
    ? source.activities.flatMap((item) => {
        if (!item || typeof item !== 'object' || typeof item.id !== 'string') return []
        const title = text(item.title).trim().slice(0, 60)
        if (!title) return []
        return [{
          id: item.id,
          title,
          emoji: emoji(item.emoji, '⭐'),
          note: text(item.note).trim().slice(0, 180),
          frequency: item.frequency === 'weekly' ? 'weekly' as const : 'daily' as const,
          days: days(item.days, SCHOOL_DAYS),
          time: clock(item.time, '16:00'),
          notify: item.notify !== false,
          pixEnabled: item.pixEnabled === true,
          pixAmount: amount(item.pixAmount),
          pixNote: text(item.pixNote).trim().slice(0, 80),
        }]
      })
    : []

  const meals = Array.isArray(source.meals)
    ? source.meals.flatMap((item) => {
        if (!item || typeof item !== 'object' || typeof item.id !== 'string') return []
        const title = text(item.title).trim().slice(0, 60)
        if (!title) return []
        return [{ id: item.id, title, emoji: emoji(item.emoji, '🍎'), time: clock(item.time, '12:00'), note: text(item.note).trim().slice(0, 180), days: days(item.days, ALL_DAYS) }]
      })
    : []

  const grades = Array.isArray(source.grades)
    ? source.grades.flatMap((item) => {
        if (!item || typeof item !== 'object' || typeof item.id !== 'string') return []
        const title = text(item.title).trim().slice(0, 80)
        const date = text(item.date)
        const max = amount(item.max) || 10
        const score = amount(item.score)
        if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return []
        return [{ id: item.id, title, subject: text(item.subject).trim().slice(0, 40) || 'Outra', score: Math.min(score, max), max, date }]
      })
    : []

  return {
    profile,
    school: schoolPlan,
    homework,
    alarms,
    activities,
    meals,
    grades,
    done: stampMap(source.done),
    pixPaid: pixMap(source.pixPaid),
    rung: flagMap(source.rung),
    notified: flagMap(source.notified),
  }
}

export function loadRoutine() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyRoutine()
    return sanitize(JSON.parse(raw))
  } catch {
    return emptyRoutine()
  }
}

export function saveRoutine(state: RoutineState) {
  const today = dateKey()
  const keep = (map: Record<string, true>) =>
    Object.fromEntries(Object.entries(map).filter(([key]) => key.slice(-10) >= shiftDate(today, -3))) as Record<string, true>
  const next = { ...state, rung: keep(state.rung), notified: keep(state.notified) }
  localStorage.setItem(KEY, JSON.stringify(next))
}

function shiftDate(iso: string, daysOffset: number) {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + daysOffset)
  return dateKey(date)
}

export function recentDates(count: number, from = new Date()) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(from)
    date.setDate(from.getDate() - index)
    return dateKey(date)
  })
}
