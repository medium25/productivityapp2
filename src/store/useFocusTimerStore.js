import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { getAudioContext } from '../audio/audioContext'
import { WORK_START_RINGTONES, REST_START_RINGTONES, playLongRingtone, pickRingtone } from '../audio/longRingtones'
import { playAmbient, stopAmbient } from '../audio/ambientPlayer'
import { createFirestoreStorage } from '../firebase/firestoreStorage'
import { createThrottledStorage } from '../firebase/throttledStorage'
import { useFocusHistoryStore, dateKey } from './useFocusHistoryStore'
import { useFocusStore } from './useFocusStore'
import { useSettingsStore } from './useSettingsStore'

// Fallback defaults for My day task sessions only (sourceType 'task') —
// Focus projects (sourceType 'project') no longer use these at all: their
// whole countdown is the project's own remaining hours budget instead (per
// user request — "however many hours a project needs, that's what's on the
// timer"), set in start() by the caller (TimerPanel). These stay 25/5 since
// that's what a brand new settings store starts at.
export const WORK_SECONDS = 25 * 60
export const BREAK_SECONDS = 5 * 60
export const BREAK_SKIP_DAILY_LIMIT = 3
// Break-offer reminders fire once an hour for a project session regardless
// of the project's total budget (per user request — a 20h project still
// only gets nudged hourly, not once per old 25min Pomodoro slot). Task
// sessions keep their existing workMinutes-based interval, untouched.
const HOUR_SECONDS = 60 * 60

const getWorkSeconds = () => Math.round((useSettingsStore.getState().workMinutes || 25) * 60)
const getBreakSeconds = () => Math.round((useSettingsStore.getState().breakMinutes || 5) * 60)
const getStretchSeconds = (sourceType) => (sourceType === 'project' ? HOUR_SECONDS : getWorkSeconds())
// How often the running countdown gets written to Firestore. A per-second
// write (one per tick) would be ~1500 writes per 25-minute session for no
// real benefit. 60s (rather than a shorter interval) is deliberate — a
// graceful tab close/switch already flushes instantly via visibilitychange/
// pagehide below, so this interval only matters for a true crash/power-loss,
// where losing up to a minute of an in-progress countdown is inconsequential.
// Tightening this back up costs 3x the write quota per minute of active use.
const SESSION_SAVE_INTERVAL_MS = 60 * 1000

// Intervals live outside the store's state (and outside React) on purpose:
// the Pomodoro session must keep running while the Focus timer view is
// unmounted (user browsing other projects or other sections).
let tickInterval = null
let stopPhaseRingtone = null

// Plays the phase-change ringtone once, capped at its own natural ~32s
// length (playLongRingtone, not the indefinitely-looping variant) — no
// escalating "are you still there?" nudging, and no ringing on forever if
// the user doesn't check in (per user request: the only sound this timer
// ever makes on its own is this single bounded notification every work
// stretch). accept/declineBreakOffer stop it early if the user answers
// before it finishes on its own.
function playPhaseRingtone(pool, selectedId) {
  stopPhaseRingtoneIfAny()
  stopPhaseRingtone = playLongRingtone(getAudioContext(), pickRingtone(pool, selectedId))
}

function stopPhaseRingtoneIfAny() {
  if (stopPhaseRingtone) {
    stopPhaseRingtone()
    stopPhaseRingtone = null
  }
}

const clearTick = () => {
  if (tickInterval) {
    clearInterval(tickInterval)
    tickInterval = null
  }
}

const focusSessionStorage = createThrottledStorage(
  createFirestoreStorage('productivity-hub-focus-session'),
  SESSION_SAVE_INTERVAL_MS
)

if (typeof document !== 'undefined') {
  // The tab going to background is the closest real signal we get to "the
  // user might not come back" — flush immediately rather than waiting for
  // the throttle window, since this is exactly the moment progress could
  // otherwise be lost.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      focusSessionStorage.flush()
    } else {
      stopPhaseRingtoneIfAny()
    }
  })
  window.addEventListener('pagehide', () => focusSessionStorage.flush())
  // Covers switching back via OS window manager (e.g. Cmd+Tab) rather than
  // a browser tab switch — visibilitychange alone doesn't always fire for
  // that depending on browser/OS, window focus reliably does.
  window.addEventListener('focus', stopPhaseRingtoneIfAny)
}

export const useFocusTimerStore = create(
  persist(
    (set, get) => ({
      projectId: null,
      // 'project' (Focus's own projects, the default) | 'task' (a My day
      // task — see MyDayTimer.jsx) — which store `projectId` actually
      // refers to, so shared consumers (FloatingTimerWidget, Statistics)
      // can resolve it correctly instead of assuming it's always a Focus
      // project id.
      sourceType: 'project',
      // idle | work | break | stopped
      //   break: only reachable via acceptBreakOffer.
      phase: 'idle',
      // True for the moment a work stretch hits its interval (see
      // workStretchRemaining) until the user answers — plays a one-shot
      // rest-start ringtone and shows the "want to rest?" prompt, but
      // *doesn't* pause anything: work keeps counting down underneath the
      // whole time (per user request, the timer itself must never freeze
      // just because a notification is up). acceptBreakOffer is the only
      // thing that actually stops it, switching to a real break countdown;
      // declineBreakOffer just clears this flag and work carries on exactly
      // as it already was.
      breakOfferPending: false,
      // True for a few seconds right after a break runs out on its own and
      // work resumes automatically (see _tick's 'break' branch) — per user
      // report, the work-start ringtone fired with nothing on screen to say
      // why, so this drives a same "here's what that sound was" banner as
      // breakOfferPending's, just self-dismissing since there's no decision
      // to make here (work's already resumed either way). TimerPanel clears
      // it on a timeout.
      workResumedNotice: false,
      pausedPhase: null,
      remaining: WORK_SECONDS,
      // Total length of whichever phase is currently on screen (work or
      // break) — captured when that phase starts, so a mid-session change to
      // workMinutes/breakMinutes doesn't retroactively distort the progress
      // bar of a session already running.
      totalSeconds: WORK_SECONDS,
      // The work session's own progress, preserved separately from
      // remaining/totalSeconds — a break temporarily borrows those two
      // fields for its own countdown, then work picks up from here instead
      // of restarting, once the break ends (or is declined/skipped).
      workRemaining: WORK_SECONDS,
      workTotal: WORK_SECONDS,
      // Counts down independently of the work session's own remaining time
      // — reaching 0 is what triggers the next break-offer notification, on
      // a fixed interval (getWorkSeconds(), 25min by default) regardless of
      // how long the overall work session (a task's estimate) actually is.
      workStretchRemaining: WORK_SECONDS,
      soundId: 'none',

      setSoundId: (soundId) => {
        set({ soundId })
        // Ambient sound only plays during work — resting stays quiet even if
        // the user changes the pick mid-break, it just takes effect next work phase.
        if (get().phase === 'work') playAmbient(soundId)
        focusSessionStorage.flush()
      },

      // `options.workSeconds` is the whole session length — for a Focus
      // project (sourceType 'project') the caller (TimerPanel) now computes
      // this from the project's own remaining hours budget (see
      // getProjectRemainingSeconds in useFocusStore.js), not a Pomodoro
      // slot; for a My day task it's still that task's own time estimate
      // (see TimerPanel's `defaultWorkMinutes`). Omitted, falls back to the
      // shared workMinutes setting.
      start: (projectId, options = {}) => {
        getAudioContext()
        clearTick()
        stopPhaseRingtoneIfAny()
        const sourceType = options.sourceType || 'project'
        const workSeconds = options.workSeconds || getWorkSeconds()
        const stretchSeconds = getStretchSeconds(sourceType)
        set({
          projectId,
          sourceType,
          phase: 'work',
          breakOfferPending: false,
          workResumedNotice: false,
          remaining: workSeconds,
          totalSeconds: workSeconds,
          workRemaining: workSeconds,
          workTotal: workSeconds,
          workStretchRemaining: stretchSeconds,
          pausedPhase: null,
        })
        playAmbient(get().soundId)
        tickInterval = setInterval(() => get()._tick(), 1000)
        focusSessionStorage.flush()
      },

      _tick: () => {
        const { phase, projectId, sourceType } = get()
        if (phase === 'work') {
          if (projectId) {
            useFocusHistoryStore.getState().addSecond(dateKey(), projectId)
            // Permanently debits the project's remaining budget (per user
            // request — it must persist across sessions/days, not reset
            // daily), independent of the history log above which is purely
            // for the charts.
            if (sourceType === 'project') useFocusStore.getState().addProjectSecond(projectId)
          }
          const nextRemaining = Math.max(0, get().remaining - 1)
          // A project's budget just ran out — end the session outright
          // rather than ticking at 0 forever (per user request: the
          // countdown IS the project's total remaining hours, so hitting 0
          // means there's nothing left to spend).
          if (sourceType === 'project' && nextRemaining <= 0) {
            get().finish()
            return
          }
          const nextStretch = get().workStretchRemaining - 1
          if (nextStretch <= 0) {
            // A work stretch just hit the interval — play the one-shot
            // "want to rest?" notification, but keep ticking right through
            // it (per user request: the countdown itself never stops just
            // because a notification is up, only accepting the break does
            // that). workStretchRemaining resets here so the next interval
            // still fires on schedule even if this one goes unanswered.
            playPhaseRingtone(REST_START_RINGTONES, useSettingsStore.getState().restStartRingtoneId)
            set({
              remaining: nextRemaining,
              workRemaining: nextRemaining,
              workStretchRemaining: getStretchSeconds(sourceType),
              breakOfferPending: true,
            })
            focusSessionStorage.flush()
            return
          }
          set({ remaining: nextRemaining, workRemaining: nextRemaining, workStretchRemaining: nextStretch })
        } else if (phase === 'break') {
          const remaining = get().remaining
          if (remaining > 1) {
            set({ remaining: remaining - 1 })
            return
          }
          // Break ran out on its own — resume work automatically instead of
          // the old ringing/awaiting-continue chain, right where it paused.
          clearTick()
          playPhaseRingtone(WORK_START_RINGTONES, useSettingsStore.getState().workStartRingtoneId)
          const { workRemaining, workTotal } = get()
          set({
            phase: 'work',
            remaining: workRemaining,
            totalSeconds: workTotal,
            workStretchRemaining: getStretchSeconds(sourceType),
            workResumedNotice: true,
          })
          playAmbient(get().soundId)
          tickInterval = setInterval(() => get()._tick(), 1000)
          focusSessionStorage.flush()
        }
      },

      // The "want to rest?" notification's two answers. Work never actually
      // stopped while the notification was up (see _tick), so only accept
      // has real work to do — swap the still-running work tick for a break
      // one. Decline just dismisses the prompt; nothing else changes.
      acceptBreakOffer: () => {
        if (!get().breakOfferPending) return
        stopPhaseRingtoneIfAny()
        clearTick()
        stopAmbient()
        const { projectId } = get()
        if (projectId) useFocusHistoryStore.getState().incrementCycle(dateKey(), projectId)
        const breakSeconds = getBreakSeconds()
        set({ phase: 'break', breakOfferPending: false, remaining: breakSeconds, totalSeconds: breakSeconds })
        // The "want to rest?" offer already played this same ringtone (see
        // _tick's work branch) — but per user report, the actual moment the
        // timer flips into rest (this line) played nothing, since accepting
        // only ever stopped that earlier sound. It needs its own cue right
        // here, same as _tick's auto-resume-to-work branch already gets one.
        playPhaseRingtone(REST_START_RINGTONES, useSettingsStore.getState().restStartRingtoneId)
        tickInterval = setInterval(() => get()._tick(), 1000)
        focusSessionStorage.flush()
      },

      declineBreakOffer: () => {
        if (!get().breakOfferPending) return
        stopPhaseRingtoneIfAny()
        set({ breakOfferPending: false })
        focusSessionStorage.flush()
      },

      dismissWorkResumedNotice: () => set({ workResumedNotice: false }),

      // Silences the ringtone immediately without answering the break offer
      // or dismissing the work-resumed notice — per user request, a plain
      // "stop that sound" button distinct from accept/decline (which already
      // stopped it as a side effect, but only once you'd made a decision).
      muteRingtone: () => stopPhaseRingtoneIfAny(),

      // Ends the break early and resumes work — capped at
      // BREAK_SKIP_DAILY_LIMIT/day so it doesn't become a way to just never
      // rest once a break has actually been accepted.
      skipBreak: () => {
        if (get().phase !== 'break') return
        const today = dateKey()
        const skipsSoFar = useFocusHistoryStore.getState().breakSkips[today] || 0
        if (skipsSoFar >= BREAK_SKIP_DAILY_LIMIT) return
        useFocusHistoryStore.getState().incrementBreakSkip(today)
        clearTick()
        const { workRemaining, workTotal, sourceType } = get()
        set({
          phase: 'work',
          remaining: workRemaining,
          totalSeconds: workTotal,
          workStretchRemaining: getStretchSeconds(sourceType),
        })
        playAmbient(get().soundId)
        tickInterval = setInterval(() => get()._tick(), 1000)
        focusSessionStorage.flush()
      },

      // Stopping is only allowed during work — a break, once accepted, runs
      // its course (or gets skipBreak'd short). No reminder tone while
      // stopped — the timer already isn't running at this point, so there's
      // nothing left "ringing" to nag the user with.
      stop: () => {
        if (get().phase !== 'work') return
        clearTick()
        stopAmbient()
        stopPhaseRingtoneIfAny()
        set((state) => ({ phase: 'stopped', pausedPhase: state.phase, breakOfferPending: false, workResumedNotice: false }))
        focusSessionStorage.flush()
      },

      // Resumes exactly where the session was paused — remaining time and
      // phase (work/break) are left untouched, nothing resets.
      continueFocus: () => {
        set((state) => ({ phase: state.pausedPhase || 'work', pausedPhase: null }))
        if (get().phase === 'work') playAmbient(get().soundId)
        if (!tickInterval) {
          tickInterval = setInterval(() => get()._tick(), 1000)
        }
        focusSessionStorage.flush()
      },

      finish: () => {
        clearTick()
        stopAmbient()
        stopPhaseRingtoneIfAny()
        const workSeconds = getWorkSeconds()
        set({
          phase: 'idle',
          breakOfferPending: false,
          workResumedNotice: false,
          remaining: workSeconds,
          totalSeconds: workSeconds,
          workRemaining: workSeconds,
          workTotal: workSeconds,
          workStretchRemaining: workSeconds,
          projectId: null,
          sourceType: 'project',
          pausedPhase: null,
        })
        focusSessionStorage.flush()
      },
    }),
    {
      name: 'productivity-hub-focus-session',
      storage: focusSessionStorage,
      skipHydration: true,
      partialize: (state) => ({
        projectId: state.projectId,
        sourceType: state.sourceType,
        phase: state.phase,
        breakOfferPending: state.breakOfferPending,
        pausedPhase: state.pausedPhase,
        remaining: state.remaining,
        totalSeconds: state.totalSeconds,
        workRemaining: state.workRemaining,
        workTotal: state.workTotal,
        workStretchRemaining: state.workStretchRemaining,
        soundId: state.soundId,
        // Stamped at the moment this particular snapshot was computed (not
        // when it's eventually written, which the throttle above may delay)
        // so the elapsed-time catch-up below stays accurate either way.
        savedAt: Date.now(),
      }),
      // Runs once after rehydrateAllPersistedStores() reads the saved
      // session back from Firestore (see ../store/rehydrateStores.js).
      // Closing the app doesn't pause real time, so a plain restore would
      // leave a stale countdown behind — this fast-forwards the counters by
      // however long the app was actually closed, landing on the same
      // state a live tick would have reached (minus the ringtone — autoplay
      // needs a fresh user gesture the reload doesn't have, so the user
      // just sees the same prompt silently, work still counted down).
      onRehydrateStorage: () => (state, error) => {
        if (error || !state) return
        let { phase, sourceType, breakOfferPending, remaining, totalSeconds, workRemaining, workTotal, workStretchRemaining, soundId, savedAt } = state
        if ((phase === 'work' || phase === 'break') && savedAt) {
          const elapsedSeconds = Math.max(0, Math.floor((Date.now() - savedAt) / 1000))
          if (phase === 'work') {
            remaining = Math.max(0, remaining - elapsedSeconds)
            workRemaining = remaining
            const nextStretch = workStretchRemaining - elapsedSeconds
            if (nextStretch <= 0) {
              breakOfferPending = true
              workStretchRemaining = getStretchSeconds(sourceType)
            } else {
              workStretchRemaining = nextStretch
            }
          } else {
            const nextRemaining = remaining - elapsedSeconds
            if (nextRemaining > 0) {
              remaining = nextRemaining
            } else {
              // Break ran out while away — resume work right where it paused.
              phase = 'work'
              remaining = workRemaining
              totalSeconds = workTotal
              workStretchRemaining = getStretchSeconds(sourceType)
            }
          }
        }
        useFocusTimerStore.setState({ phase, breakOfferPending, remaining, totalSeconds, workRemaining, workTotal, workStretchRemaining })
        if (phase === 'work' || phase === 'break') {
          clearTick()
          if (phase === 'work') playAmbient(soundId)
          tickInterval = setInterval(() => useFocusTimerStore.getState()._tick(), 1000)
        }
      },
    }
  )
)
