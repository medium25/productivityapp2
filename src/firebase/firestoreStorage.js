import { collection, doc, getDoc, getDocs, getDocsFromCache, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { getCurrentUid } from './currentUid'

// All stores hydrate at sign-in, and each one used to read its own document —
// ~20 separate round trips before the app had its data. The first read now
// fetches the whole appData collection in ONE request and every store takes its
// document from that snapshot. The snapshot is dropped (invalidateAppDataCache)
// whenever stores are re-hydrated on purpose (sign-in, pull-to-refresh), so it
// never serves stale data. If the bulk read fails — or returns nothing from an
// empty offline cache, which would look like "no data" — each store falls back
// to reading its own document, as before.
let bulk = null // { uid, promise }

export function invalidateAppDataCache() {
  flushPendingWrites() // a re-read must see what was just typed
  bulk = null
}

// Keys of documents written on this device since the last full hydration. A late
// server refresh must not overwrite a store the user has already changed.
const dirtyKeys = new Set()
export const clearDirtyKeys = () => dirtyKeys.clear()
export const isDirtyKey = (key) => dirtyKeys.has(key)

const toMap = (snap) => {
  const all = new Map()
  snap.forEach((d) => all.set(d.id, d.data()))
  return all
}

// Instant read from the local (IndexedDB) copy — no network. null when this
// device has nothing cached yet (first launch / cleared storage).
export async function readCachedAppData(uid) {
  const snap = await getDocsFromCache(collection(db, 'users', uid, 'appData'))
  return snap.empty ? null : toMap(snap)
}

// Full read from the server (falls back to the cache when offline).
export async function readServerAppData(uid) {
  return toMap(await getDocs(collection(db, 'users', uid, 'appData')))
}

// Make the next store reads come from this snapshot instead of the network.
export function primeAppData(uid, all) {
  bulk = { uid, promise: Promise.resolve(all) }
}

function readAllAppData(uid) {
  const promise = getDocs(collection(db, 'users', uid, 'appData')).then((snap) => {
    if (snap.empty && snap.metadata.fromCache) throw new Error('appData not available yet')
    return toMap(snap)
  })
  promise.catch(() => { if (bulk?.promise === promise) bulk = null })
  return promise
}

// Every store change used to write its whole document to Firestore at once —
// typing a chat message re-sent every message on each keystroke, which made
// input lag on phones. Writes are now coalesced per document: only the latest
// state is sent, a moment after the changes stop (and right away when the page
// is hidden or closed, or before stores are re-read), so nothing is lost.
const WRITE_DELAY_MS = 800
const pendingWrites = new Map() // document path -> { ref, value, timer }

function sendWrite(path) {
  const entry = pendingWrites.get(path)
  if (!entry) return
  clearTimeout(entry.timer)
  pendingWrites.delete(path)
  setDoc(entry.ref, entry.value).catch((e) => console.error('Firestore write failed:', e))
}

export function flushPendingWrites() {
  for (const path of [...pendingWrites.keys()]) sendWrite(path)
}

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushPendingWrites() })
  window.addEventListener('pagehide', flushPendingWrites)
}

// A zustand `persist` storage backed by Firestore instead of localStorage,
// one document per store under the signed-in user's own subtree. Reads the
// uid lazily on every call (not at import time) so it always reflects
// whoever is currently signed in, and stays a no-op while signed out —
// stores only start writing once rehydrateAllPersistedStores() runs after
// login (see ../store/rehydrateStores.js).
export function createFirestoreStorage(key) {
  const docRef = () => {
    const uid = getCurrentUid()
    return uid ? doc(db, 'users', uid, 'appData', key) : null
  }

  return {
    __key: key,
    getItem: async () => {
      const ref = docRef()
      if (!ref) return null
      const uid = getCurrentUid()
      try {
        if (!bulk || bulk.uid !== uid) bulk = { uid, promise: readAllAppData(uid) }
        const all = await bulk.promise
        return all.get(key) ?? null
      } catch {
        const snap = await getDoc(ref)
        return snap.exists() ? snap.data() : null
      }
    },
    setItem: async (_name, value) => {
      const ref = docRef()
      if (!ref) return
      const path = ref.path
      dirtyKeys.add(key)
      const previous = pendingWrites.get(path)
      if (previous) clearTimeout(previous.timer)
      pendingWrites.set(path, { ref, value, timer: setTimeout(() => sendWrite(path), WRITE_DELAY_MS) })
    },
    removeItem: async () => {
      const ref = docRef()
      if (!ref) return
      const queued = pendingWrites.get(ref.path)
      if (queued) { clearTimeout(queued.timer); pendingWrites.delete(ref.path) }
      await deleteDoc(ref)
    },
  }
}
