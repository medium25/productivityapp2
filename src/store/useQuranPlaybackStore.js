import { create } from 'zustand'

// Live playback state for the Quran recitation, published by the audio
// engine (src/audio/quranAudioEngine.js) and read by QuranPlayer's UI.
// Deliberately NOT persisted and NOT a hook-bound player: the engine is a
// module singleton that keeps the <audio> element alive across route
// changes, so recitation doesn't stop when you leave the My Focus page.
export const useQuranPlaybackStore = create(() => ({
  playing: false,
  currentTime: 0,
  duration: 0,
  loading: true,
  error: false,
}))
