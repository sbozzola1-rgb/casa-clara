import { activityOccurs, alarmOnDay, dateKey, eventKey, type ActivityItem, type RoutineState } from './model.ts'
import { askNotificationPermission } from './sound.ts'

const TOPIC_KEY = 'casa-clara.rotina.topic'
const PLAN_KEY = 'casa-clara.rotina.notices'
const NTFY = 'https://ntfy.sh'

export type Notice = { id: string; at: number; title: string; body: string }

let armed = false
let queue = Promise.resolve()

function topic() {
  const saved = localStorage.getItem(TOPIC_KEY)
  if (saved && /^[A-Za-z0-9_-]{8,64}$/.test(saved)) return saved
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  const next = `laura${[...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`
  localStorage.setItem(TOPIC_KEY, next)
  return next
}

function safeId(value: string) {
  const clean = value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64)
  return clean.length > 0 ? clean : 'aviso'
}

function decodeKey(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4)
  const raw = atob(padded)
  const bytes = new Uint8Array(raw.length)
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index)
  return bytes
}

function atTime(day: Date, time: string) {
  if (!/^\d{2}:\d{2}$/.test(time)) return 0
  const [hour, minute] = time.split(':').map(Number)
  const at = new Date(day)
  at.setHours(hour, minute, 0, 0)
  return at.getTime()
}

export function collectNotices(state: RoutineState, timer: ActivityItem | null, endsAt: number | null, now: Date) {
  const notices: Notice[] = []
  const soon = now.getTime()
  for (let offset = 0; offset < 3; offset += 1) {
    const day = new Date(now)
    day.setDate(now.getDate() + offset)
    const stamp = dateKey(day)
    for (const alarm of state.alarms) {
      if (!alarmOnDay(alarm, day)) continue
      const at = atTime(day, alarm.time)
      const key = eventKey('alarm', alarm.id, stamp)
      if (at <= soon || state.rung[key]) continue
      notices.push({ id: safeId(`al${key}`), at, title: 'Despertador', body: `${alarm.emoji} ${alarm.label}`.trim() })
    }
    for (const item of state.activities) {
      if (!item.notify || !activityOccurs(item, day)) continue
      const at = atTime(day, item.time)
      const key = eventKey('activity', item.id, stamp)
      if (at <= soon || state.notified[key]) continue
      notices.push({ id: safeId(`ac${key}`), at, title: item.title, body: `${item.emoji} Hora de ${item.title}`.trim() })
    }
  }
  if (timer && endsAt != null && endsAt > soon) {
    notices.push({ id: safeId(`timer${timer.id}`), at: endsAt, title: timer.title, body: 'Acabou o tempo!' })
  }
  return notices
}

export async function armTabletNotices() {
  const permission = await askNotificationPermission()
  if (permission !== 'granted' || !('serviceWorker' in navigator) || !('PushManager' in window)) return false
  if (armed) return true
  try {
    const registration = await navigator.serviceWorker.ready
    const config = await fetch(`${NTFY}/v1/config`).then((response) => response.json() as Promise<{ web_push_public_key?: string }>)
    if (!config.web_push_public_key) return false
    const applicationServerKey = decodeKey(config.web_push_public_key)
    let subscription = await registration.pushManager.getSubscription()
    if (!subscription) {
      try {
        subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })
      } catch {
        const existing = await registration.pushManager.getSubscription()
        await existing?.unsubscribe()
        subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })
      }
    }
    const json = subscription.toJSON()
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return false
    const saved = await fetch(`${NTFY}/v1/webpush`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, topics: [topic()] }),
    })
    if (!saved.ok) {
      await subscription.unsubscribe()
      return false
    }
    armed = true
    window.dispatchEvent(new Event('rotina-armed'))
    return true
  } catch {
    return false
  }
}

async function writeNotices(notices: Notice[]) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const name = topic()
  const now = Date.now()
  const limit = now + 3 * 24 * 60 * 60 * 1000 - 60_000
  const wanted = new Map<string, Notice>()
  for (const notice of notices) {
    if (notice.at < now + 12_000 || notice.at > limit) continue
    wanted.set(notice.id, notice)
  }
  const signature = JSON.stringify([...wanted].map(([id, notice]) => [id, notice.at, notice.title, notice.body]))
  if (signature === localStorage.getItem(PLAN_KEY)) return
  const previous = (() => {
    try {
      const raw = JSON.parse(localStorage.getItem(`${PLAN_KEY}.ids`) || '[]') as unknown
      return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === 'string') : []
    } catch {
      return []
    }
  })()
  const kept: string[] = []
  for (const [id, notice] of wanted) {
    const response = await fetch(NTFY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        topic: name,
        sequence_id: id,
        title: notice.title,
        message: notice.body,
        priority: 5,
        tags: [`rotina-${id}`],
        delay: String(Math.floor(notice.at / 1000)),
        click: new URL('laura.html', new URL(import.meta.env.BASE_URL, location.origin)).href,
      }),
    })
    if (response.ok) kept.push(id)
  }
  for (const id of previous) {
    if (wanted.has(id)) continue
    await fetch(`${NTFY}/${name}/${id}`, { method: 'DELETE' }).catch(() => undefined)
  }
  localStorage.setItem(`${PLAN_KEY}.ids`, JSON.stringify(kept))
  if (kept.length === wanted.size) localStorage.setItem(PLAN_KEY, signature)
}

export function syncNotices(notices: Notice[]) {
  queue = queue.then(() => writeNotices(notices)).catch(() => undefined)
  return queue
}
