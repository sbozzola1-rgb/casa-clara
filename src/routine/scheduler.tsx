import { useEffect, useState } from 'react'
import { activityOccurs, dateKey, eventKey, isDue, type ActivityItem, type AlarmItem } from './model.ts'
import { notifyDevice, startAlarmSound, stopAlarmSound, unlockAudio } from './sound.ts'
import { useRoutine } from './store.tsx'

const seen = new Set<string>()

export function RoutineScheduler() {
  const { state, markRung, markNotified, setTab } = useRoutine()
  const [alarms, setAlarms] = useState<AlarmItem[] | null>(null)
  const [activity, setActivity] = useState<ActivityItem | null>(null)

  useEffect(() => {
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock)
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const day = dateKey(now)
      const dueAlarms = state.alarms.filter((alarm) => {
        const key = eventKey('alarm', alarm.id, day)
        return alarm.enabled && alarm.days.includes(now.getDay()) && isDue(alarm.time, now) && !state.rung[key] && !seen.has(key)
      })
      if (dueAlarms.length > 0) {
        for (const alarm of dueAlarms) {
          const key = eventKey('alarm', alarm.id, day)
          seen.add(key)
          markRung(key)
        }
        setAlarms(dueAlarms)
        startAlarmSound()
        void notifyDevice('Despertador', dueAlarms.map((alarm) => alarm.label).join(', '), `alarm-${day}`)
      }

      const dueActivities = state.activities.filter((item) => {
        const key = eventKey('activity', item.id, day)
        return item.notify && activityOccurs(item, now) && isDue(item.time, now) && !state.notified[key] && !seen.has(key)
      })
      if (dueActivities.length > 0) {
        const first = dueActivities[0]
        for (const item of dueActivities) {
          const key = eventKey('activity', item.id, day)
          seen.add(key)
          markNotified(key)
        }
        setActivity(first)
        void notifyDevice(`Hora de ${first.title}`, first.time, `activity-${first.id}-${day}`)
      }
    }

    tick()
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [markNotified, markRung, state.activities, state.alarms, state.notified, state.rung])

  return (
    <>
      {alarms ? (
        <div className="routine-root fixed inset-0 z-[80] grid place-items-center bg-[#2a1438]/80 px-6">
          <div className="ring-pulse card w-full max-w-md px-6 py-8 text-center">
            <p className="text-6xl">{alarms[0]?.emoji ?? '⏰'}</p>
            <p className="font-display mt-3 text-6xl">{alarms[0]?.time}</p>
            <h2 className="font-display mt-2 text-3xl">{alarms.map((alarm) => alarm.label).join(' · ')}</h2>
            <p className="mt-2 text-[var(--soft)]">Chegou a hora no tablet.</p>
            <button
              type="button"
              className="btn-primary mt-6 w-full"
              onClick={() => {
                stopAlarmSound()
                setAlarms(null)
              }}
            >
              Já acordei!
            </button>
          </div>
        </div>
      ) : null}
      {activity ? (
        <div className="fixed top-4 right-4 left-4 z-[70] mx-auto max-w-md">
          <div className="card flex items-center gap-4 px-5 py-4">
            <span className="text-4xl">{activity.emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-[var(--soft)]">{activity.time}</p>
              <p className="font-display text-2xl">Hora de {activity.title}</p>
            </div>
            <button
              type="button"
              className="btn-primary min-h-11 px-4 text-sm"
              onClick={() => {
                setActivity(null)
                setTab('atividades')
              }}
            >
              Ver
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
