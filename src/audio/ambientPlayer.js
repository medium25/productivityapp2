import { getAudioContext } from './audioContext'
import { buildAmbientGraph } from './ambientSounds'

// Plain (non-hook) singleton so it can be driven from the timer store,
// which must keep running while no component is mounted to it.
let current = null

// Deliberately keeps playing no matter what's in front of it — minimizing,
// switching tabs, or switching to another app — since the whole point of a
// focus/ambient track is to keep going in the background while you work
// elsewhere. The only thing that can still cut it off is the OS itself
// suspending the AudioContext (e.g. a phone call), handled separately in
// audioContext.js.
export function playAmbient(id, volume = 0.5) {
  stopAmbient()
  if (!id || id === 'none') return
  const ctx = getAudioContext()
  const { output, stop: stopGraph } = buildAmbientGraph(ctx, id)
  const gain = ctx.createGain()
  gain.gain.value = 0
  output.connect(gain)
  gain.connect(ctx.destination)
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.6)
  current = { stopGraph, gain, ctx, volume }
}

// Live volume change for whatever's currently playing (the Settings slider)
// — ramped, not snapped, so dragging it doesn't click.
export function setAmbientVolume(volume) {
  if (!current) return
  const { gain, ctx } = current
  const v = Math.max(0, Math.min(1, volume))
  current.volume = v
  gain.gain.cancelScheduledValues(ctx.currentTime)
  gain.gain.setTargetAtTime(v, ctx.currentTime, 0.08)
}

export function stopAmbient() {
  if (!current) return
  const { stopGraph, gain, ctx } = current
  gain.gain.cancelScheduledValues(ctx.currentTime)
  gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime)
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.4)
  setTimeout(() => {
    stopGraph()
    try { gain.disconnect() } catch { /* already disconnected */ }
  }, 450)
  current = null
}
