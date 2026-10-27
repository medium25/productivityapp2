import { create } from 'zustand'
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  RecaptchaVerifier,
  signInWithPhoneNumber,
} from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { setCurrentUid } from '../firebase/currentUid'
import { rehydrateAllPersistedStores, resetAllStores } from './rehydrateStores'
import { useFriendsStore } from './useFriendsStore'
import { useCompetitionsStore } from './useCompetitionsStore'

// Kept outside the store (like the Pomodoro intervals in useFocusTimerStore)
// since neither a live reCAPTCHA widget nor a confirmation callback belongs
// in serializable zustand state.
let recaptchaVerifier = null
let confirmationResult = null

async function ensureUserProfile(user) {
  const profileRef = doc(db, 'users', user.uid)
  const snap = await getDoc(profileRef)
  if (!snap.exists()) {
    await setDoc(profileRef, {
      uid: user.uid,
      email: user.email || null,
      phoneNumber: user.phoneNumber || null,
      createdAt: Date.now(),
    })
  }
  // Lets other users find this account by email when sending a friend
  // request — see src/store/useFriendsStore.js.
  if (user.email) {
    const flag = `arkad:dir:${user.uid}`
    let done = false
    try { done = localStorage.getItem(flag) === '1' } catch { /* private mode */ }
    if (!done) {
      await setDoc(doc(db, 'userDirectory', user.email.toLowerCase()), { uid: user.uid }, { merge: true })
      try { localStorage.setItem(flag, '1') } catch { /* private mode */ }
    }
  }
}

export const useAuthStore = create((set) => ({
  user: null,
  status: 'loading', // loading | ready
  error: null,

  signUpEmail: async (email, password) => {
    set({ error: null })
    try {
      await createUserWithEmailAndPassword(auth, email, password)
    } catch (e) {
      set({ error: e.message })
      throw e
    }
  },

  signInEmail: async (email, password) => {
    set({ error: null })
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (e) {
      set({ error: e.message })
      throw e
    }
  },

  sendPhoneOtp: async (phoneNumber, recaptchaContainerId) => {
    set({ error: null })
    try {
      if (!recaptchaVerifier) {
        recaptchaVerifier = new RecaptchaVerifier(auth, recaptchaContainerId, { size: 'invisible' })
      }
      confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier)
    } catch (e) {
      set({ error: e.message })
      throw e
    }
  },

  confirmPhoneOtp: async (code) => {
    set({ error: null })
    try {
      if (!confirmationResult) throw new Error('No verification code was requested')
      await confirmationResult.confirm(code)
      confirmationResult = null
    } catch (e) {
      set({ error: e.message })
      throw e
    }
  },

  signOutUser: () => signOut(auth),
}))

const START_TIMEOUT_MS = 6000

onAuthStateChanged(auth, async (firebaseUser) => {
  if (firebaseUser) {
    setCurrentUid(firebaseUser.uid)
    // Open the app as soon as the stores hold data — from this device's own copy
    // when there is one (milliseconds), otherwise after the first server read.
    // Never wait for the profile write below, and never hang here for long on a
    // bad connection: after START_TIMEOUT_MS the app opens with what it has.
    const { ready } = rehydrateAllPersistedStores()
    await Promise.race([ready, new Promise((resolve) => setTimeout(resolve, START_TIMEOUT_MS))])
    useAuthStore.setState({ user: firebaseUser, status: 'ready' })
    // The profile is only bookkeeping (friend lookup by email) — do it in the
    // background, once the data is in, so it doesn't compete for the connection.
    ensureUserProfile(firebaseUser).catch((e) => {
      // Signed in with Firebase Auth even if this write failed (e.g. rules not deployed).
      console.error('ensureUserProfile failed:', e)
    })
    // useFriendsStore/useCompetitionsStore are intentionally NOT started
    // here anymore — both keep permanent onSnapshot listeners open for as
    // long as they're running, which used to mean every signed-in user paid
    // that read cost for the whole session even if they never opened the
    // Friends panel. They're started/stopped from FriendsPanel.jsx's mount
    // effect instead, so the cost only exists while that panel is actually
    // visible. The stop() calls below on sign-out stay as a safety net.
  } else {
    // Clear the uid first so the reset below can't slip a setItem() call
    // through to the just-signed-out account's Firestore data.
    setCurrentUid(null)
    resetAllStores()
    useFriendsStore.getState().stop()
    useCompetitionsStore.getState().stop()
    useAuthStore.setState({ user: null, status: 'ready' })
  }
})
