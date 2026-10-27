import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { pinRoutine } from './door.ts'
import { pullRoutine, pushRoutine, signIn, subscribeHousehold, supabase } from '../lib/cloud.ts'
import {
  dateKey,
  doneKey,
  homeworkKey,
  loadRoutine,
  pixKey,
  sanitize,
  saveRoutine,
  type ActivityItem,
  type AlarmItem,
  type GradeItem,
  type HomeworkItem,
  type MealItem,
  type Profile,
  type RoutineState,
  type SchoolItem,
  type TabId,
} from './model.ts'

type Role = 'child' | 'parent'

interface RoutineStore {
  state: RoutineState
  role: Role
  tab: TabId
  today: Date
  toast: string | null
  setTab: (tab: TabId) => void
  notify: (message: string) => void
  saveProfile: (profile: Profile) => void
  unlock: (pin: string) => boolean
  setPin: (pin: string, recovery?: string) => void
  leaveParent: () => void
  resetPin: (word: string) => boolean
  saveSchool: (item: SchoolItem) => void
  removeSchool: (id: string) => void
  saveHomework: (item: HomeworkItem) => void
  removeHomework: (id: string) => void
  saveAlarm: (item: AlarmItem) => void
  removeAlarm: (id: string) => void
  saveActivity: (item: ActivityItem) => void
  removeActivity: (id: string) => void
  saveMeal: (item: MealItem) => void
  removeMeal: (id: string) => void
  saveGrade: (item: GradeItem) => void
  removeGrade: (id: string) => void
  toggleDone: (kind: 'school' | 'activity' | 'meal' | 'homework', id: string) => void
  markPix: (activityId: string, day?: string) => void
  markRung: (key: string) => void
  markNotified: (key: string) => void
  replaceState: (input: unknown) => void
  timer: ActivityItem | null
  timerEndsAt: number | null
  timerLeft: number
  playTimer: (item: ActivityItem) => void
  pauseTimer: (left: number) => void
  resumeTimer: () => void
  closeTimer: () => void
  cloudChecked: boolean
  linked: boolean
  houseMessage: string | null
  linkHouse: (password: string) => Promise<'saved' | 'opened' | 'empty'>
}

const RoutineContext = createContext<RoutineStore | null>(null)
const REV_KEY = 'casa-clara.rotina.rev'
const TIMER_KEY = 'casa-clara.rotina.running'

function readRunning(): { item: ActivityItem; endsAt: number | null; left: number } | null {
  try {
    const raw = JSON.parse(localStorage.getItem(TIMER_KEY) || 'null') as { item?: ActivityItem; endsAt?: unknown; left?: unknown } | null
    if (!raw?.item || typeof raw.item.id !== 'string' || typeof raw.item.title !== 'string') return null
    const endsAt = typeof raw.endsAt === 'number' ? raw.endsAt : null
    const left = typeof raw.left === 'number' ? raw.left : 0
    if (endsAt != null && endsAt < Date.now() - 12 * 60 * 60 * 1000) return null
    return { item: raw.item, endsAt, left }
  } catch {
    return null
  }
}

function readRev() {
  try {
    const value = Number(localStorage.getItem(REV_KEY) || 0)
    return Number.isFinite(value) && value > 0 ? value : 0
  } catch {
    return 0
  }
}

function writeRev(value: number) {
  localStorage.setItem(REV_KEY, String(value))
}

async function syncRoutine(local: RoutineState, currentRev: number) {
  const remote = await pullRoutine()
  const remoteState = remote ? sanitize(remote.state) : null
  const remoteRev = remoteState?.profile ? remote?.revision ?? 0 : 0
  if (local.profile && currentRev === 0) {
    await pushRoutine(local, 1)
    return { result: 'saved' as const, revision: 1 }
  }
  if (remoteState?.profile && remoteRev > currentRev) {
    return { result: 'opened' as const, state: remoteState, revision: remoteRev }
  }
  if (local.profile && remoteRev < currentRev) {
    await pushRoutine(local, currentRev)
    return { result: 'saved' as const, revision: currentRev }
  }
  if (!local.profile && remoteState?.profile) {
    return { result: 'opened' as const, state: remoteState, revision: remoteRev }
  }
  if (local.profile) return { result: 'opened' as const, revision: currentRev }
  return { result: 'empty' as const, revision: currentRev }
}

function withoutId<T>(map: Record<string, T>, id: string) {
  return Object.fromEntries(Object.entries(map).filter(([key]) => !key.includes(id)))
}

export function RoutineProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RoutineState>(loadRoutine)
  const [role, setRole] = useState<Role>('child')
  const [tab, setTab] = useState<TabId>('hoje')
  const [toast, setToast] = useState<string | null>(null)
  const [today] = useState(() => new Date())
  const restored = useState(readRunning)[0]
  const [timer, setTimer] = useState<ActivityItem | null>(restored?.item ?? null)
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(restored?.endsAt ?? null)
  const [timerLeft, setTimerLeft] = useState(restored?.left ?? 0)
  const [cloudChecked, setCloudChecked] = useState(false)
  const [linked, setLinked] = useState(false)
  const [houseMessage, setHouseMessage] = useState<string | null>(null)
  const ignorePush = useRef(true)
  const revision = useRef(readRev())
  const stateRef = useRef(state)
  stateRef.current = state

  const applyCloud = useCallback((outcome: { result: 'saved' | 'opened' | 'empty'; state?: RoutineState; revision: number }) => {
    revision.current = outcome.revision
    writeRev(outcome.revision)
    ignorePush.current = true
    if (outcome.state) setState(outcome.state)
    if (outcome.result === 'saved') setHouseMessage('Pronto. A rotina ficou nesta tela.')
    if (outcome.result !== 'empty') setLinked(true)
    return outcome.result
  }, [])

  const linkHouse = useCallback(async (password: string) => {
    const hadProfile = Boolean(stateRef.current.profile)
    try {
      await signIn(password)
    } catch {
      throw new Error('Senha incorreta.')
    }
    if (!hadProfile) pinRoutine(true)
    try {
      return applyCloud(await syncRoutine(stateRef.current, revision.current))
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      throw new Error(message || 'Não consegui gravar a rotina na casa.')
    }
  }, [applyCloud])

  useEffect(() => {
    saveRoutine(state)
  }, [state])

  useEffect(() => {
    if (!timer) {
      localStorage.removeItem(TIMER_KEY)
      return
    }
    localStorage.setItem(TIMER_KEY, JSON.stringify({ item: timer, endsAt: timerEndsAt, left: timerLeft }))
  }, [timer, timerEndsAt, timerLeft])

  useEffect(() => {
    let cancel = false
    void (async () => {
      try {
        if (!supabase) return
        const { data } = await supabase.auth.getSession()
        if (cancel || !data.session) return
        const outcome = await syncRoutine(stateRef.current, revision.current)
        if (cancel || outcome.result === 'empty') return
        applyCloud(outcome)
        if (outcome.result === 'saved' && outcome.revision === 1) {
          setToast('Rotina guardada nesta tela.')
        }
      } catch {
        if (!cancel) setToast('Não consegui buscar a rotina da casa.')
      } finally {
        if (!cancel) setCloudChecked(true)
      }
    })()
    return () => {
      cancel = true
    }
  }, [applyCloud])

  useEffect(() => {
    if (!linked) return
    return subscribeHousehold((row) => {
      const payload = row.data && typeof row.data === 'object'
        ? ((row.data as { routine?: { revision?: unknown; state?: unknown }; __routine?: { revision?: unknown; state?: unknown } }).routine
          ?? (row.data as { __routine?: { revision?: unknown; state?: unknown } }).__routine)
        : undefined
      const nextRev = Number(payload?.revision) || 0
      if (!payload?.state || nextRev <= revision.current) return
      const next = sanitize(payload.state)
      if (!next.profile) return
      ignorePush.current = true
      revision.current = nextRev
      writeRev(nextRev)
      setState(next)
    })
  }, [linked])

  useEffect(() => {
    if (!linked || !state.profile) return
    if (ignorePush.current) {
      ignorePush.current = false
      return
    }
    const snapshot = state
    const timer = window.setTimeout(() => {
      const next = revision.current + 1
      void pushRoutine(snapshot, next)
        .then(() => {
          revision.current = next
          writeRev(next)
        })
        .catch(() => setToast('Não consegui salvar a rotina na casa.'))
    }, 500)
    return () => window.clearTimeout(timer)
  }, [linked, state])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(timer)
  }, [toast])

  const notify = useCallback((message: string) => setToast(message), [])

  const patch = useCallback((recipe: (current: RoutineState) => RoutineState) => {
    setState((current) => recipe(current))
  }, [])

  const replaceList = useCallback(<T extends { id: string }>(list: T[], item: T) => {
    const exists = list.some((entry) => entry.id === item.id)
    return exists ? list.map((entry) => (entry.id === item.id ? item : entry)) : [...list, item]
  }, [])

  const value = useMemo<RoutineStore>(() => ({
    state,
    role,
    tab,
    today,
    toast,
    setTab,
    notify,
    saveProfile: (profile) => patch((current) => ({ ...current, profile })),
    unlock: (pin) => {
      if (state.profile?.pin && state.profile.pin === pin) {
        setRole('parent')
        return true
      }
      return false
    },
    setPin: (pin, recovery) => {
      const word = recovery?.trim().toLocaleLowerCase('pt-BR')
      patch((current) => (
        current.profile
          ? { ...current, profile: { ...current.profile, pin, recovery: word || current.profile.recovery } }
          : current
      ))
      setRole('parent')
    },
    leaveParent: () => setRole('child'),
    resetPin: (word) => {
      const expected = state.profile?.recovery ?? ''
      if (!expected || word.trim().toLocaleLowerCase('pt-BR') !== expected) return false
      patch((current) => (current.profile ? { ...current, profile: { ...current.profile, pin: '' } } : current))
      setRole('child')
      return true
    },
    saveSchool: (item) => patch((current) => ({ ...current, school: replaceList(current.school, item) })),
    removeSchool: (id) => patch((current) => ({ ...current, school: current.school.filter((item) => item.id !== id), done: withoutId(current.done, id) })),
    saveHomework: (item) => patch((current) => ({ ...current, homework: replaceList(current.homework, item) })),
    removeHomework: (id) => patch((current) => ({ ...current, homework: current.homework.filter((item) => item.id !== id), done: withoutId(current.done, id) })),
    saveAlarm: (item) => patch((current) => ({ ...current, alarms: replaceList(current.alarms, item) })),
    removeAlarm: (id) => patch((current) => ({ ...current, alarms: current.alarms.filter((item) => item.id !== id) })),
    saveActivity: (item) => patch((current) => ({ ...current, activities: replaceList(current.activities, item) })),
    removeActivity: (id) => patch((current) => ({
      ...current,
      activities: current.activities.filter((item) => item.id !== id),
      done: withoutId(current.done, id),
      pixPaid: withoutId(current.pixPaid, id),
    })),
    saveMeal: (item) => patch((current) => ({ ...current, meals: replaceList(current.meals, item) })),
    removeMeal: (id) => patch((current) => ({ ...current, meals: current.meals.filter((item) => item.id !== id), done: withoutId(current.done, id) })),
    saveGrade: (item) => patch((current) => ({ ...current, grades: replaceList(current.grades, item) })),
    removeGrade: (id) => patch((current) => ({ ...current, grades: current.grades.filter((item) => item.id !== id) })),
    toggleDone: (kind, id) => {
      const key = kind === 'homework' ? homeworkKey(id) : doneKey(kind, id, dateKey())
      patch((current) => {
        if (kind === 'activity' && current.done[key] && current.pixPaid[pixKey(id, dateKey())]) return current
        const done = { ...current.done }
        if (done[key]) delete done[key]
        else done[key] = { at: new Date().toISOString() }
        return { ...current, done }
      })
    },
    markPix: (activityId, day = dateKey()) => {
      const key = pixKey(activityId, day)
      patch((current) => {
        const activity = current.activities.find((item) => item.id === activityId)
        if (!activity?.pixEnabled) return current
        const pixPaid = { ...current.pixPaid }
        if (pixPaid[key]) delete pixPaid[key]
        else pixPaid[key] = { at: new Date().toISOString(), amount: activity.pixAmount }
        return { ...current, pixPaid }
      })
    },
    markRung: (key) => patch((current) => (current.rung[key] ? current : { ...current, rung: { ...current.rung, [key]: true } })),
    markNotified: (key) => patch((current) => (current.notified[key] ? current : { ...current, notified: { ...current.notified, [key]: true } })),
    timer,
    timerEndsAt,
    timerLeft,
    playTimer: (item) => {
      if (item.timerMinutes <= 0) return
      const left = item.timerMinutes * 60
      setTimer(item)
      setTimerLeft(left)
      setTimerEndsAt(Date.now() + left * 1000)
    },
    pauseTimer: (left) => {
      setTimerEndsAt(null)
      setTimerLeft(Math.max(0, Math.round(left)))
    },
    resumeTimer: () => setTimerEndsAt(Date.now() + Math.max(1, timerLeft) * 1000),
    closeTimer: () => {
      setTimer(null)
      setTimerEndsAt(null)
      setTimerLeft(0)
    },
    cloudChecked,
    linked,
    houseMessage,
    linkHouse,
    replaceState: (input) => {
      const next = sanitize(input)
      if (!next.profile) throw new Error('arquivo')
      setState(next)
    },
  }), [cloudChecked, houseMessage, linkHouse, linked, notify, patch, replaceList, role, state, tab, timer, timerEndsAt, timerLeft, toast, today])

  return <RoutineContext.Provider value={value}>{children}</RoutineContext.Provider>
}

export function useRoutine() {
  const store = useContext(RoutineContext)
  if (!store) throw new Error('Rotina fora do provedor')
  return store
}
