import { collection, doc, getDoc, getDocs, getDocsFromCache, runTransaction, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { getCurrentUid } from './currentUid'
import { mergeDocs } from './docMerge'

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
//
// Stale-device guard. A document is saved whole, so a device that started from an old
// local copy used to overwrite newer work done on another device. Now every document
// carries a revision (`rev`); this device remembers the revision and content it last saw
// (`baseRev` / `baseVal`). A save runs in a transaction: if the cloud's revision is not the
// one this device saw, the cloud's version and this device's changes are merged record by
// record (see docMerge.js) instead of one replacing the other, and the store is re-read.
// Each save is first put in a small local outbox, so edits made offline — or while the page
// is closing — are replayed (and merged) on the next start.
const WRITE_DELAY_MS = 800
const pendingWrites = new Map() // document path -> { key, ref, value, timer }
const chains = new Map() // document path -> promise (saves of one document run one after another)
const seqs = new Map() // document path -> number of the newest save (an older, retried one is dropped)
const baseRev = new Map() // store key -> revision last seen / written by this device
const baseVal = new Map() // store key -> document content last seen / written by this device
let onMerged = null // (key) => void — set by rehydrateStores: re-read a store after a merge

export function setMergedHandler(fn) { onMerged = fn }

const outboxKey = (uid, key) => `arkad:outbox:${uid}:${key}`
const saveOutbox = (uid, key, payload) => { try { localStorage.setItem(outboxKey(uid, key), JSON.stringify(payload)) } catch { /* quota / private mode */ } }
const clearOutbox = (uid, key) => { try { localStorage.removeItem(outboxKey(uid, key)) } catch { /* ignore */ } }

// One guarded save. `expected` / `base` default to what this device last saw.
export async function commitDoc(ref, key, value, { expected = baseRev.get(key) ?? 0, base = baseVal.get(key) ?? null, run = runTransaction } = {}) {
  let merged = false
  const result = await run(db, async (tx) => {
    const snap = await tx.get(ref)
    const server = snap.exists() ? snap.data() : null
    const serverRev = server?.rev ?? 0
    let out = value
    merged = false
    // The cloud moved on since this device last saw it. A document without `rev` (written by an
    // older app version) is compared by content.
    const moved = server && (serverRev !== expected
      || (serverRev === 0 && base && JSON.stringify(server.state) !== JSON.stringify(base.state)))
    if (moved) { out = mergeDocs(base, server, value); merged = true }
    const doc = { ...out, rev: serverRev + 1 }
    tx.set(ref, doc)
    return doc
  })
  baseRev.set(key, result.rev)
  baseVal.set(key, result)
  if (merged && onMerged) onMerged(key)
  return result
}

function sendWrite(path) {
  const entry = pendingWrites.get(path)
  if (!entry) return
  clearTimeout(entry.timer)
  pendingWrites.delete(path)
  const { key, ref, value } = entry
  const uid = getCurrentUid()
  const seq = (seqs.get(path) || 0) + 1
  seqs.set(path, seq)
  // Outbox first (synchronous), so nothing is lost if the page closes mid-save.
  if (uid) saveOutbox(uid, key, { value, rev: baseRev.get(key) ?? 0, base: baseVal.get(key) ?? null })
  const run = (attempt) => (chains.get(path) || Promise.resolve())
    .then(() => commitDoc(ref, key, value))
    .then(() => { if (seqs.get(path) === seq && !pendingWrites.has(path) && uid) clearOutbox(uid, key) })
    .catch((e) => {
      console.error('Firestore write failed:', e)
      // Offline or contended: try again later — unless a newer save of the same document has taken over.
      const delay = Math.min(60000, 3000 * 2 ** attempt)
      setTimeout(() => { if (seqs.get(path) === seq && !pendingWrites.has(path)) chains.set(path, run(attempt + 1)) }, delay)
    })
  chains.set(path, run(0))
}

// Saves left in the outbox by an earlier session (offline edits, or a page closed mid-save)
// are sent now. Returns the store keys that were replayed.
export async function replayOutbox(uid) {
  const keys = []
  let names = []
  try { names = Object.keys(localStorage).filter((k) => k.startsWith(`arkad:outbox:${uid}:`)) } catch { return keys }
  for (const name of names) {
    const key = name.slice(`arkad:outbox:${uid}:`.length)
    try {
      const saved = JSON.parse(localStorage.getItem(name))
      if (!saved?.value) { localStorage.removeItem(name); continue }
      const ref = doc(db, 'users', uid, 'appData', key)
      await commitDoc(ref, key, saved.value, { expected: saved.rev ?? 0, base: saved.base ?? null })
      localStorage.removeItem(name)
      keys.push(key)
    } catch (e) {
      console.error('Outbox replay failed:', e) // stays in the outbox for the next start
    }
  }
  return keys
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

  // What this device now knows of the document (the base of its next guarded save).
  const remember = (data) => {
    if (data) { baseRev.set(key, data.rev ?? 0); baseVal.set(key, data) } else { baseRev.set(key, 0); baseVal.delete(key) }
    return data
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
        return remember(all.get(key) ?? null)
      } catch {
        const snap = await getDoc(ref)
        return remember(snap.exists() ? snap.data() : null)
      }
    },
    setItem: async (_name, value) => {
      const ref = docRef()
      if (!ref) return
      const path = ref.path
      dirtyKeys.add(key)
      const previous = pendingWrites.get(path)
      if (previous) clearTimeout(previous.timer)
      pendingWrites.set(path, { key, ref, value, timer: setTimeout(() => sendWrite(path), WRITE_DELAY_MS) })
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
