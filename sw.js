const CACHE_NAME = 'simple-energy-v1'
const STATIC_CACHE = 'static-v1'
const DYNAMIC_CACHE = 'dynamic-v1'

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/001.png',
  '/manifest.json'
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing Service Worker ...')
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[Service Worker] Caching Static Assets')
        return cache.addAll(STATIC_ASSETS)
      })
      .then(() => self.skipWaiting())
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating Service Worker ....')
  event.waitUntil(
    caches.keys()
      .then((keyList) => {
        return Promise.all(keyList.map((key) => {
          if (key !== STATIC_CACHE && key !== DYNAMIC_CACHE) {
            console.log('[Service Worker] Removing old cache.', key)
            return caches.delete(key)
          }
        }))
      })
      .then(() => self.clients.claim())
  )
})

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return
  }

  // Skip chrome-extension and other non-http requests
  if (!url.protocol.startsWith('http')) {
    return
  }

  // Network first strategy for API calls
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request))
    return
  }

  // Cache first strategy for static assets
  event.respondWith(cacheFirst(request))
})

// Cache first strategy
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request)
  if (cachedResponse) {
    return cachedResponse
  }

  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (error) {
    console.log('[Service Worker] Fetch failed:', error)
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/')
    }
    throw error
  }
}

// Network first strategy
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE)
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch (error) {
    const cachedResponse = await caches.match(request)
    if (cachedResponse) {
      return cachedResponse
    }
    throw error
  }
}

// Handle push notifications (for future use)
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  const title = data.title || 'Simple Energy'
  const options = {
    body: data.body || 'Nueva notificación de Simple Energy',
    icon: '/001.png',
    badge: '/001.png',
    data: data.url || '/'
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  )
})

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    clients.openWindow(event.notification.data)
  )
})
