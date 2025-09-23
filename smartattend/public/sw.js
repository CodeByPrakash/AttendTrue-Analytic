// public/sw.js - Service Worker for SmartAttend PWA

const CACHE_NAME = 'smartattend-v1.0.0';
const OFFLINE_PAGE = '/offline.html';

// Resources to cache for offline functionality
const CACHE_URLS = [
  '/',
  '/offline.html',
  '/student/dashboard',
  '/student/join-session',
  '/teacher/dashboard',
  '/teacher/create-session',
  '/admin/dashboard',
  '/login',
  '/styles/globals.css',
  '/models/ssd_mobilenetv1_model-shard1',
  '/models/ssd_mobilenetv1_model-shard2',
  '/models/ssd_mobilenetv1_model-weights_manifest.json',
  '/models/face_landmark_68_model-shard1',
  '/models/face_landmark_68_model-weights_manifest.json',
  '/models/face_recognition_model-shard1',
  '/models/face_recognition_model-shard2',
  '/models/face_recognition_model-weights_manifest.json',
];

// Install event - Cache resources
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching app shell and critical resources');
        return cache.addAll(CACHE_URLS);
      })
      .then(() => {
        console.log('Service Worker installed successfully');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker installation failed:', error);
      })
  );
});

// Activate event - Clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('Service Worker activated');
        return self.clients.claim();
      })
  );
});

// Fetch event - Serve cached content when offline
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Ignore Next.js internals, dev HMR, and asset loader endpoints to avoid breaking Fast Refresh
  const url = new URL(event.request.url);
  if (
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/__nextjs') ||
    url.pathname.includes('webpack-hmr') ||
    url.pathname.includes('hot-update') ||
    url.pathname.includes('__next') ||
    url.pathname.startsWith('/sockjs-node')
  ) {
    return; // Let the network handle HMR and Next internals
  }

  // Handle API requests with network-first strategy
  if (event.request.url.includes('/api/')) {
    event.respondWith(handleApiRequest(event.request));
    return;
  }

  // Handle page requests with cache-first strategy for static assets
  if (event.request.mode === 'navigate') {
    event.respondWith(handlePageRequest(event.request));
    return;
  }

  // Handle other requests (CSS, JS, images) with cache-first strategy
  event.respondWith(handleStaticRequest(event.request));
});

// Network-first strategy for API requests with offline queue
async function handleApiRequest(request) {
  try {
    const response = await fetch(request);
    
    // Cache successful GET requests
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('API request failed, checking cache:', request.url);
    
    // Try to serve from cache for GET requests
    if (request.method === 'GET') {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
    }
    
    // Queue POST requests for later when online
    if (request.method === 'POST') {
      await queueRequest(request);
      return new Response(
        JSON.stringify({ 
          message: 'Request queued for when online',
          queued: true,
          timestamp: new Date().toISOString()
        }),
        { 
          status: 202,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Return offline response for other failed requests
    return new Response(
      JSON.stringify({ message: 'Network unavailable', offline: true }),
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Cache-first strategy for page navigation
async function handlePageRequest(request) {
  try {
    // Try network first for navigation
    const response = await fetch(request);
    
    // Cache successful responses
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    
    return response;
  } catch (error) {
    console.log('Page request failed, serving from cache:', request.url);
    
    // Try to serve from cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Serve offline page as fallback
    const offlineResponse = await caches.match(OFFLINE_PAGE);
    return offlineResponse || new Response('Offline - No cached version available');
  }
}

// Cache-first strategy for static assets
async function handleStaticRequest(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const response = await fetch(request);
    
    // Cache successful responses
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    console.log('Static request failed:', request.url);
    return new Response('Resource unavailable offline');
  }
}

// Queue requests for processing when back online
async function queueRequest(request) {
  try {
    const requestData = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers.entries()),
      body: await request.text(),
      timestamp: new Date().toISOString()
    };
    
    // Store in IndexedDB for persistence
    const db = await openDatabase();
    const transaction = db.transaction(['offline_queue'], 'readwrite');
    const store = transaction.objectStore('offline_queue');
    
    await store.add({
      ...requestData,
      id: `${Date.now()}-${Math.random()}`
    });
    
    console.log('Request queued for offline processing:', requestData.url);
  } catch (error) {
    console.error('Failed to queue request:', error);
  }
}

// IndexedDB setup for offline queue
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SmartAttendOffline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create offline queue store
      if (!db.objectStoreNames.contains('offline_queue')) {
        const store = db.createObjectStore('offline_queue', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
      
      // Create attendance cache store
      if (!db.objectStoreNames.contains('attendance_cache')) {
        const store = db.createObjectStore('attendance_cache', { keyPath: 'id' });
        store.createIndex('sessionId', 'sessionId', { unique: false });
        store.createIndex('studentId', 'studentId', { unique: false });
      }
    };
  });
}

// Background sync for processing queued requests
self.addEventListener('sync', (event) => {
  if (event.tag === 'process-offline-queue') {
    event.waitUntil(processOfflineQueue());
  }
});

// Process queued requests when back online
async function processOfflineQueue() {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(['offline_queue'], 'readwrite');
    const store = transaction.objectStore('offline_queue');
    
    const requests = await store.getAll();
    
    for (const requestData of requests) {
      try {
        const response = await fetch(requestData.url, {
          method: requestData.method,
          headers: requestData.headers,
          body: requestData.body
        });
        
        if (response.ok) {
          // Remove from queue on success
          await store.delete(requestData.id);
          console.log('Processed queued request:', requestData.url);
        }
      } catch (error) {
        console.error('Failed to process queued request:', error);
        // Keep in queue for next sync attempt
      }
    }
  } catch (error) {
    console.error('Failed to process offline queue:', error);
  }
}

// Push notification handling (for future attendance reminders)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      timestamp: new Date().toISOString()
    },
    actions: [
      {
        action: 'open',
        title: 'Open SmartAttend'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('SmartAttend', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

console.log('SmartAttend Service Worker loaded successfully');
