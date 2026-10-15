import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { getCurrentUid } from './currentUid'

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
      const snap = await getDoc(ref)
      return snap.exists() ? snap.data() : null
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
