import { create } from 'zustand'
import { collection, doc, onSnapshot, query, where, setDoc, updateDoc, getDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { getCurrentUid } from '../firebase/currentUid'

// Not persisted — always live from Firestore. A friendRequest doc IS the
// friendship record once accepted (status: 'accepted'), so "friends" is
// derived client-side from the same two listeners as incoming/outgoing
// requests, not a separate collection (see firestore.rules for why).
let unsubscribers = []
let asSender = []
let asRecipient = []

function recompute(set, myUid) {
  const all = [...asSender, ...asRecipient]
  set({
    incoming: asRecipient.filter((r) => r.status === 'pending'),
    outgoing: asSender.filter((r) => r.status === 'pending'),
    friends: all
      .filter((r) => r.status === 'accepted')
      .map((r) => (r.fromUid === myUid
        ? { uid: r.toUid, email: r.toEmail }
        : { uid: r.fromUid, email: r.fromEmail })),
  })
}

function clearListeners() {
  unsubscribers.forEach((u) => u())
  unsubscribers = []
  asSender = []
  asRecipient = []
}

export const useFriendsStore = create((set) => ({
  friends: [],
  incoming: [],
  outgoing: [],

  start: () => {
    clearListeners()
    const uid = getCurrentUid()
    if (!uid) return

    const fromUnsub = onSnapshot(query(collection(db, 'friendRequests'), where('fromUid', '==', uid)), (snap) => {
      asSender = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      recompute(set, uid)
    })
    const toUnsub = onSnapshot(query(collection(db, 'friendRequests'), where('toUid', '==', uid)), (snap) => {
      asRecipient = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      recompute(set, uid)
    })
    unsubscribers = [fromUnsub, toUnsub]
  },

  stop: () => {
    clearListeners()
    set({ friends: [], incoming: [], outgoing: [] })
  },

  // Returns { ok: true } or { error: 'not-found' | 'self' | 'exists' }.
  sendFriendRequest: async (myUid, myEmail, targetEmail) => {
    const email = targetEmail.trim().toLowerCase()
    if (!email || email === myEmail.toLowerCase()) return { error: 'self' }
    const dirSnap = await getDoc(doc(db, 'userDirectory', email))
    if (!dirSnap.exists()) return { error: 'not-found' }
    const toUid = dirSnap.data().uid
    if (toUid === myUid) return { error: 'self' }
    const reqId = `${myUid}_${toUid}`
    const existing = await getDoc(doc(db, 'friendRequests', reqId))
    if (existing.exists()) return { error: 'exists' }
    await setDoc(doc(db, 'friendRequests', reqId), {
      fromUid: myUid,
      fromEmail: myEmail.toLowerCase(),
      toUid,
      toEmail: email,
      status: 'pending',
      createdAt: Date.now(),
    })
    return { ok: true }
  },

  acceptFriendRequest: (id) => updateDoc(doc(db, 'friendRequests', id), { status: 'accepted' }),
  declineFriendRequest: (id) => deleteDoc(doc(db, 'friendRequests', id)),
}))
