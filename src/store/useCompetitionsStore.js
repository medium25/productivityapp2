import { create } from 'zustand'
import { collection, doc, onSnapshot, query, where, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { getCurrentUid } from '../firebase/currentUid'
import { useFocusHistoryStore } from './useFocusHistoryStore'
import { useTrophiesStore } from './useTrophiesStore'
import { sumSecondsInRange } from '../features/focus/dateRanges'

const COMPETITION_DAYS = 10
// Only relevant while the Friends panel is actually open (see
// FriendsPanel.jsx's start()/stop() effect) — a competition runs over 10
// days, so a few minutes of lag on the opponent's hours display costs
// nothing real. 5 min instead of 1 min is a 5x cut on both the write (own
// hours) and the read it triggers on the opponent's open listener, for
// every minute the panel is left open.
const HOURS_PUSH_INTERVAL_MS = 5 * 60 * 1000

let unsubscribers = []
let hoursUnsub = null
let hoursPushInterval = null

function clearHoursWatch() {
  if (hoursUnsub) {
    hoursUnsub()
    hoursUnsub = null
  }
  if (hoursPushInterval) {
    clearInterval(hoursPushInterval)
    hoursPushInterval = null
  }
}

function clearListeners() {
  unsubscribers.forEach((u) => u())
  unsubscribers = []
  clearHoursWatch()
}

export const useCompetitionsStore = create((set, get) => ({
  active: null,
  myHours: 0,
  opponentHours: 0,

  start: () => {
    clearListeners()
    const uid = getCurrentUid()
    if (!uid) return
    const q = query(
      collection(db, 'competitions'),
      where('participants', 'array-contains', uid),
      where('status', '==', 'active')
    )
    const unsub = onSnapshot(q, (snap) => {
      const active = snap.docs[0] ? { id: snap.docs[0].id, ...snap.docs[0].data() } : null
      set({ active })
      get()._watchHours(active)
    })
    unsubscribers = [unsub]
  },

  stop: () => {
    clearListeners()
    set({ active: null, myHours: 0, opponentHours: 0 })
  },

  _watchHours: (active) => {
    clearHoursWatch()
    if (!active) {
      set({ myHours: 0, opponentHours: 0 })
      return
    }
    const uid = getCurrentUid()
    const opponentUid = active.participants.find((p) => p !== uid)

    const computeMyHours = () => {
      const seconds = useFocusHistoryStore.getState().seconds
      return sumSecondsInRange(seconds, new Date(active.startDate), new Date()) / 3600
    }
    const pushMyHours = () => {
      const myHours = computeMyHours()
      set({ myHours })
      setDoc(doc(db, 'competitions', active.id, 'participantHours', uid), { hours: myHours, updatedAt: Date.now() })
      get()._maybeFinish()
    }
    pushMyHours()
    hoursPushInterval = setInterval(pushMyHours, HOURS_PUSH_INTERVAL_MS)

    hoursUnsub = onSnapshot(doc(db, 'competitions', active.id, 'participantHours', opponentUid), (snap) => {
      set({ opponentHours: snap.exists() ? snap.data().hours : 0 })
    })
  },

  // Both participants call this independently once the competition's time
  // is up — each only ever writes their own trophy, so there's no race.
  _maybeFinish: async () => {
    const { active, myHours, opponentHours } = get()
    if (!active || active.status !== 'active') return
    if (new Date() < new Date(active.endDate)) return
    const uid = getCurrentUid()
    const opponentUid = active.participants.find((p) => p !== uid)
    await updateDoc(doc(db, 'competitions', active.id), { status: 'finished' })
    if (myHours > opponentHours) {
      useTrophiesStore.getState().addCompetitionTrophy({
        opponentEmail: active.participantEmails[opponentUid],
        awardedAt: active.endDate,
        myHours,
        opponentHours,
      })
    }
  },

  // friend = { uid, email }
  startCompetition: async (myUid, myEmail, friend) => {
    if (get().active) return
    const start = new Date()
    const end = new Date(start)
    end.setDate(end.getDate() + COMPETITION_DAYS)
    const id = crypto.randomUUID()
    await setDoc(doc(db, 'competitions', id), {
      participants: [myUid, friend.uid],
      participantEmails: { [myUid]: myEmail, [friend.uid]: friend.email },
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      status: 'active',
      createdAt: Date.now(),
    })
  },
}))
