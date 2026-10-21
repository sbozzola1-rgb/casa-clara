let ctx: AudioContext | null = null
let timer: number | null = null

function context() {
  ctx = ctx ?? new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function unlockAudio() {
  try {
    context()
  } catch {
    /* o navegador ainda não liberou o som */
  }
}

function tone(frequency: number, at: number, duration: number, volume = 0.08) {
  const audio = context()
  const oscillator = audio.createOscillator()
  const gain = audio.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = frequency
  gain.gain.value = 0.0001
  oscillator.connect(gain)
  gain.connect(audio.destination)
  const start = audio.currentTime + at
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.02)
}

export function playPop() {
  try {
    tone(660, 0, 0.12, 0.05)
    tone(880, 0.08, 0.16, 0.05)
  } catch {
    /* sem som */
  }
}

export function startAlarmSound() {
  try {
    if (timer != null) return
    const chime = () => {
      tone(784, 0, 0.22, 0.07)
      tone(988, 0.18, 0.28, 0.06)
    }
    chime()
    timer = window.setInterval(chime, 1100)
  } catch {
    /* sem som */
  }
}

export function stopAlarmSound() {
  if (timer != null) window.clearInterval(timer)
  timer = null
}

export function playFinish() {
  try {
    tone(523, 0, 0.18, 0.06)
    tone(659, 0.16, 0.2, 0.06)
    tone(784, 0.34, 0.28, 0.07)
  } catch {
    /* sem som */
  }
}

export async function notifyDevice(title: string, body: string, tag: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  const icon = `${import.meta.env.BASE_URL}rotina-icon.svg`
  try {
    const registration = await navigator.serviceWorker?.getRegistration()
    if (registration) {
      await registration.showNotification(title, { body, tag, icon, lang: 'pt-BR' })
      return
    }
  } catch {
    /* tenta a notificação da página */
  }
  try {
    new Notification(title, { body, tag, lang: 'pt-BR' })
  } catch {
    /* o tablet avisou só dentro do app */
  }
}

export async function askNotificationPermission() {
  if (typeof Notification === 'undefined') return 'denied' as NotificationPermission
  if (Notification.permission !== 'default') return Notification.permission
  return Notification.requestPermission()
}
