import { collection, doc, getDoc, getDocs, setDoc, deleteDoc } from 'firebase/firestore'
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
  bulk = null
}

function readAllAppData(uid) {
  const promise = getDocs(collection(db, 'users', uid, 'appData')).then((snap) => {
    if (snap.empty && snap.metadata.fromCache) throw new Error('appData not available yet')
    const all = new Map()
    snap.forEach((d) => all.set(d.id, d.data()))
    return all
  })
  promise.catch(() => { if (bulk?.promise === promise) bulk = null })
  return promise
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
      await setDoc(ref, value)
    },
    removeItem: async () => {
      const ref = docRef()
      if (!ref) return
      await deleteDoc(ref)
    },
  }
}
