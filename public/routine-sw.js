self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  const fallback = { title: 'Rotina', body: 'Chegou a hora.', tag: 'rotina', url: new URL('laura.html', self.location).href }
  let title = fallback.title
  let body = fallback.body
  let tag = fallback.tag
  let url = fallback.url
  try {
    const data = event.data?.json()
    if (data && typeof data === 'object') {
      if (typeof data.title === 'string' && data.title.trim()) title = data.title
      if (typeof data.message === 'string' && data.message.trim()) body = data.message
      if (typeof data.click === 'string' && data.click.startsWith('http')) url = data.click
      const tags = Array.isArray(data.tags) ? data.tags : []
      const own = tags.find((item) => typeof item === 'string' && item.startsWith('rotina-'))
      if (typeof own === 'string') tag = own
    }
  } catch {
    const text = event.data?.text()
    if (text) body = text
  }
  event.waitUntil(self.registration.showNotification(title, {
    body,
    tag,
    lang: 'pt-BR',
    renotify: true,
    requireInteraction: true,
    vibrate: [240, 120, 240, 120, 480],
    icon: new URL('rotina-icon.svg', self.location).href,
    data: { url },
  }))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || new URL('laura.html', self.location).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes('laura.html') && 'focus' in client) return client.focus()
      }
      return self.clients.openWindow(target)
    }),
  )
})
