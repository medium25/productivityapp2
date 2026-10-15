// Deliberately not the useAuthStore hook: firestoreStorage.js needs the
// current uid, and useAuthStore in turn triggers rehydration of every
// Firestore-backed store (which import firestoreStorage) — importing the
// hook here would create a module cycle. This tiny leaf module breaks it.
let currentUid = null

export function setCurrentUid(uid) {
  currentUid = uid
}

export function getCurrentUid() {
  return currentUid
}
