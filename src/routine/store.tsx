import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
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
}

const RoutineContext = createContext<RoutineStore | null>(null)

function withoutId<T>(map: Record<string, T>, id: string) {
  return Object.fromEntries(Object.entries(map).filter(([key]) => !key.includes(id)))
}

export function RoutineProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RoutineState>(loadRoutine)
  const [role, setRole] = useState<Role>('child')
  const [tab, setTab] = useState<TabId>('hoje')
  const [toast, setToast] = useState<string | null>(null)
  const [today] = useState(() => new Date())

  useEffect(() => {
    saveRoutine(state)
  }, [state])

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
    replaceState: (input) => {
      const next = sanitize(input)
      if (!next.profile) throw new Error('arquivo')
      setState(next)
    },
  }), [notify, patch, replaceList, role, state, tab, toast, today])

  return <RoutineContext.Provider value={value}>{children}</RoutineContext.Provider>
}

export function useRoutine() {
  const store = useContext(RoutineContext)
  if (!store) throw new Error('Rotina fora do provedor')
  return store
}
