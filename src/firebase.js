import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
// Persistent on-disk cache (IndexedDB), not the SDK's plain in-memory
// default — per user report, opening the app with no network showed no
// data at all. firestoreStorage.js's getItem() already falls back to
// cache when the server is unreachable, but with the in-memory default
// that cache starts empty every single session (a page reload/app relaunch
// wipes it), so the very first offline read finds nothing. Multi-tab
// manager so a second browser tab or Tauri window doesn't just silently
// disable persistence in itself (Firestore's persistence is single-tab-
// owned by default).
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  // Mobile carriers / proxies often break Firestore's streaming connection, and
  // the SDK then sits on a long timeout before it gives up on it — the first
  // read (and so the whole app start) waited that long. Auto-detect switches to
  // long polling right away when streaming doesn't work.
  experimentalAutoDetectLongPolling: true,
})
export const storage = getStorage(app)
