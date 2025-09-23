import '../styles/globals.css'; // Import global styles
import { SessionProvider } from 'next-auth/react';
import { useEffect } from 'react';
import Head from 'next/head';

const handleAnimationComplete = () => {
  console.log('All letters have animated!');
};

function MyApp({ Component, pageProps: { session, ...pageProps } }) {
  useEffect(() => {
    // Register service worker only in production; in development, actively unregister
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
      const isProdEnv = process.env.NODE_ENV === 'production';
      const shouldRegisterSW = isProdEnv && !isLocalhost;

      if (shouldRegisterSW) {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('Service Worker registered successfully:', registration);

            // Check for updates
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (!newWorker) return;
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New version available
                  if (confirm('New version available! Reload to update?')) {
                    window.location.reload();
                  }
                }
              });
            });
          })
          .catch((error) => {
            console.error('Service Worker registration failed:', error);
          });

        // Listen for app install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
          e.preventDefault();
          window.deferredPrompt = e;
          console.log('App can be installed');
        });

        // Handle offline/online status
        window.addEventListener('online', () => {
          console.log('Back online');
          if ('sync' in window.ServiceWorkerRegistration.prototype) {
            navigator.serviceWorker.ready.then((registration) => {
              return registration.sync.register('process-offline-queue');
            });
          }
        });

        window.addEventListener('offline', () => {
          console.log('Gone offline');
        });
      } else {
        // Development: unregister any existing service workers and clear app caches to avoid HMR issues
        navigator.serviceWorker.getRegistrations?.().then((regs) => {
          regs.forEach((reg) => {
            reg.unregister().then((ok) => {
              if (ok) console.log('Unregistered Service Worker in dev:', reg.scope);
            });
          });
        });
        if (window.caches?.keys) {
          caches.keys().then((keys) => {
            keys
              .filter((k) => k.startsWith('smartattend-'))
              .forEach((k) => {
                caches.delete(k).then((deleted) => {
                  if (deleted) console.log('Deleted dev cache:', k);
                });
              });
          });
        }
      }
    }

    // Initialize offline data storage
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      initializeOfflineStorage();
    }
  }, []);

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#1a1a2e" />
        <meta name="description" content="Automated Student Attendance Monitoring with Multi-Factor Authentication" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" />
        
        {/* iOS specific meta tags */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="SmartAttend" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        
        {/* Note: Avoid aggressive preloads in dev to reduce console noise and potential reload churn */}
      </Head>
      
      <SessionProvider session={session}>
        <Component {...pageProps} />
      </SessionProvider>
    </>
  );
}

// Initialize IndexedDB for offline storage
async function initializeOfflineStorage() {
  try {
    const request = indexedDB.open('SmartAttendOffline', 1);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      // Create stores for offline data
      if (!db.objectStoreNames.contains('offline_queue')) {
        const store = db.createObjectStore('offline_queue', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('attendance_cache')) {
        const store = db.createObjectStore('attendance_cache', { keyPath: 'id' });
        store.createIndex('sessionId', 'sessionId', { unique: false });
        store.createIndex('studentId', 'studentId', { unique: false });
      }

      if (!db.objectStoreNames.contains('session_cache')) {
        const store = db.createObjectStore('session_cache', { keyPath: 'id' });
        store.createIndex('courseId', 'courseId', { unique: false });
      }
    };
    
    request.onsuccess = () => {
      console.log('Offline storage initialized successfully');
    };
    
    request.onerror = (error) => {
      console.error('Failed to initialize offline storage:', error);
    };
  } catch (error) {
    console.error('IndexedDB not supported:', error);
  }
}

export default MyApp;