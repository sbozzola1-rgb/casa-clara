export const ROUTINE_EVENT = 'open-routine'
export const DOOR_KEY = 'casa-clara.door'
export const SKIP_KEY = 'casa-clara.skip-routine'

export function doorOnLoad(): 'finance' | 'routine' {
  if (location.hash === '#rotina') {
    sessionStorage.removeItem(SKIP_KEY)
    return 'routine'
  }
  try {
    if (sessionStorage.getItem(SKIP_KEY) === '1') return 'finance'
    if (localStorage.getItem(DOOR_KEY) === 'routine') return 'routine'
  } catch {
    return 'finance'
  }
  return 'finance'
}

function routineUrl() {
  return new URL('rotina.html', new URL(import.meta.env.BASE_URL, location.origin)).href
}

export function openRoutine() {
  sessionStorage.removeItem(SKIP_KEY)
  if (!location.pathname.endsWith('/rotina.html')) location.assign(routineUrl())
}

export function leaveRoutine() {
  sessionStorage.setItem(SKIP_KEY, '1')
  if (location.pathname.endsWith('/rotina.html')) location.assign(new URL(import.meta.env.BASE_URL, location.origin).href)
}

export function routinePinned() {
  try {
    return localStorage.getItem(DOOR_KEY) === 'routine'
  } catch {
    return false
  }
}

export function pinRoutine(on: boolean) {
  localStorage.setItem(DOOR_KEY, on ? 'routine' : 'finance')
}
