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
    await setDoc(doc(db, 'userDirectory', user.email.toLowerCase()), { uid: user.uid }, { merge: true })
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

onAuthStateChanged(auth, async (firebaseUser) => {
  if (firebaseUser) {
    setCurrentUid(firebaseUser.uid)
    try {
      await ensureUserProfile(firebaseUser)
    } catch (e) {
      // The user IS signed in with Firebase Auth even if the Firestore
      // profile write failed (e.g. security rules not deployed yet) — still
      // let them into the app rather than hanging on a blank screen.
      console.error('ensureUserProfile failed:', e)
    }
    useAuthStore.setState({ user: firebaseUser, status: 'ready' })
    rehydrateAllPersistedStores()
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
