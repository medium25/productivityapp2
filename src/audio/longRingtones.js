// Longer, richer signature tones for phase transitions (work→rest and
// rest→work). Procedurally generated via Web Audio API — no audio files —
// each one loops a short melodic pattern until it clears a 32-second floor,
// guaranteeing every entry runs at least 30 seconds. This is the only sound
// the timer ever makes on its own; it always stops itself after that floor
// (or earlier, if the user answers the break-offer prompt first) rather
// than ringing indefinitely while nobody's there to hear it.
//
// The two pools are deliberately built from different sonic ingredients so
// they read as two different "instruments", not just different notes:
// work-start tones are bright/open (no filter, punchy envelope, mixed
// waveforms including square/sawtooth, faster tempo), rest-start tones are
// warm/soft (low-pass filtered, gentle vibrato on several, sine/triangle
// only, slower tempo). Within each pool, waveform/filter/vibrato/harmony
// and the melodic pattern shape all vary so the 10 options don't blur
// together either.
const SCALE_STEPS = {
  major: [0, 2, 4, 5, 7, 9, 11, 12],
  majorPentatonic: [0, 2, 4, 7, 9, 12],
  minorPentatonic: [0, 3, 5, 7, 10, 12],
  lydian: [0, 2, 4, 6, 7, 9, 11, 12],
  dorian: [0, 2, 3, 5, 7, 9, 10, 12],
}

const MIN_DURATION_S = 32

function degreeToFreq(root, scale, degree) {
  const octave = Math.floor(degree / scale.length)
  const step = scale[((degree % scale.length) + scale.length) % scale.length]
  return root * Math.pow(2, (step + octave * 12) / 12)
}

function playNote(ctx, startAt, freq, dur, ringtone, gainValue) {
  const { waveform, filterCutoff, attackFrac = 0.15, releaseFrac = 0.9, vibrato } = ringtone
  const osc = ctx.createOscillator()
  osc.type = waveform
  osc.frequency.value = freq

  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, startAt)
  g.gain.linearRampToValueAtTime(gainValue, startAt + dur * attackFrac)
  g.gain.exponentialRampToValueAtTime(0.0001, startAt + dur * releaseFrac)
  osc.connect(g)

  if (filterCutoff) {
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = filterCutoff
    g.connect(filter)
    filter.connect(ctx.destination)
  } else {
    g.connect(ctx.destination)
  }

  if (vibrato) {
    const lfo = ctx.createOscillator()
    lfo.frequency.value = vibrato.rate
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = vibrato.depth
    lfo.connect(lfoGain)
    lfoGain.connect(osc.frequency)
    lfo.start(startAt)
    lfo.stop(startAt + dur)
  }

  osc.start(startAt)
  osc.stop(startAt + dur + 0.05)
  return osc
}

export function playLongRingtone(ctx, ringtone, gainValue = 0.5) {
  const scale = SCALE_STEPS[ringtone.scale]
  const loopLength = ringtone.pattern.length * ringtone.noteDur
  const loops = Math.max(1, Math.ceil(MIN_DURATION_S / loopLength))
  const oscillators = []
  let t = ctx.currentTime
  for (let loop = 0; loop < loops; loop++) {
    ringtone.pattern.forEach((degree) => {
      const freq = degreeToFreq(ringtone.root, scale, degree)
      oscillators.push(playNote(ctx, t, freq, ringtone.noteDur, ringtone, gainValue))
      if (ringtone.harmonyInterval) {
        const harmonyFreq = freq * Math.pow(2, ringtone.harmonyInterval / 12)
        oscillators.push(playNote(ctx, t, harmonyFreq, ringtone.noteDur, ringtone, gainValue * 0.5))
      }
      t += ringtone.noteDur
    })
  }
  return () => oscillators.forEach((o) => { try { o.stop() } catch { /* already stopped */ } })
}

export function pickRingtone(pool, selectedId) {
  return pool.find((r) => r.id === selectedId) || pool[Math.floor(Math.random() * pool.length)]
}

// Played when a work session begins (right after a break ends) — bright
// and open: no low-pass filter, punchy envelope, mixed waveforms including
// square/sawtooth, faster tempo, mostly ascending/driving patterns.
export const WORK_START_RINGTONES = [
  { id: 'ws-sunrise', labelKey: 'focus.ringtone.wsSunrise', root: 261.63, scale: 'major', waveform: 'sine', noteDur: 0.28, pattern: [0, 2, 4, 5, 7, 9, 11, 12] },
  { id: 'ws-drive', labelKey: 'focus.ringtone.wsDrive', root: 293.66, scale: 'majorPentatonic', waveform: 'sawtooth', noteDur: 0.2, pattern: [0, 2, 4, 7, 9, 7, 4, 2] },
  { id: 'ws-focusbell', labelKey: 'focus.ringtone.wsFocusBell', root: 329.63, scale: 'lydian', waveform: 'square', noteDur: 0.32, pattern: [0, 4, 7, 11, 7, 4], harmonyInterval: 7 },
  { id: 'ws-momentum', labelKey: 'focus.ringtone.wsMomentum', root: 220, scale: 'dorian', waveform: 'triangle', noteDur: 0.22, pattern: [0, 2, 3, 5, 7, 5, 3, 2] },
  { id: 'ws-clarity', labelKey: 'focus.ringtone.wsClarity', root: 349.23, scale: 'major', waveform: 'sine', noteDur: 0.3, pattern: [0, 4, 7, 12, 7, 4], harmonyInterval: 4 },
  { id: 'ws-spark', labelKey: 'focus.ringtone.wsSpark', root: 392, scale: 'majorPentatonic', waveform: 'square', noteDur: 0.16, pattern: [0, 2, 4, 7, 4, 2, 0] },
  { id: 'ws-steady', labelKey: 'focus.ringtone.wsSteady', root: 246.94, scale: 'minorPentatonic', waveform: 'sawtooth', noteDur: 0.35, pattern: [0, 3, 5, 7, 5, 3] },
  { id: 'ws-bright', labelKey: 'focus.ringtone.wsBright', root: 440, scale: 'lydian', waveform: 'triangle', noteDur: 0.24, pattern: [0, 2, 4, 6, 9, 6, 4, 2] },
  { id: 'ws-forward', labelKey: 'focus.ringtone.wsForward', root: 261.63, scale: 'dorian', waveform: 'square', noteDur: 0.2, pattern: [0, 2, 5, 7, 10, 7, 5, 2] },
  { id: 'ws-signal', labelKey: 'focus.ringtone.wsSignal', root: 311.13, scale: 'major', waveform: 'sine', noteDur: 0.26, pattern: [0, 7, 4, 7, 12, 7], harmonyInterval: 12 },
]

// Played when a rest break begins (right after a work session ends) — warm
// and soft: low-pass filtered, several with gentle vibrato, sine/triangle
// only, slower tempo, mostly descending/floating patterns.
export const REST_START_RINGTONES = [
  { id: 'rs-breeze', labelKey: 'focus.ringtone.rsBreeze', root: 196, scale: 'majorPentatonic', waveform: 'sine', noteDur: 0.75, pattern: [7, 5, 2, 0], filterCutoff: 2200, attackFrac: 0.3, releaseFrac: 0.95, vibrato: { rate: 4.5, depth: 3 } },
  { id: 'rs-calm', labelKey: 'focus.ringtone.rsCalm', root: 220, scale: 'minorPentatonic', waveform: 'sine', noteDur: 0.9, pattern: [7, 5, 3, 0], filterCutoff: 1800, attackFrac: 0.3, releaseFrac: 0.95, harmonyInterval: 7 },
  { id: 'rs-drift', labelKey: 'focus.ringtone.rsDrift', root: 174.61, scale: 'dorian', waveform: 'triangle', noteDur: 0.85, pattern: [5, 3, 2, 0], filterCutoff: 1500, attackFrac: 0.35, releaseFrac: 0.95, vibrato: { rate: 3.5, depth: 4 } },
  { id: 'rs-lull', labelKey: 'focus.ringtone.rsLull', root: 233.08, scale: 'major', waveform: 'sine', noteDur: 1.0, pattern: [7, 4, 2, 0], filterCutoff: 2000, attackFrac: 0.3, releaseFrac: 0.95, harmonyInterval: 4 },
  { id: 'rs-quietbell', labelKey: 'focus.ringtone.rsQuietBell', root: 261.63, scale: 'lydian', waveform: 'sine', noteDur: 1.2, pattern: [7, 4, 0], filterCutoff: 2600, attackFrac: 0.25, releaseFrac: 0.96 },
  { id: 'rs-glow', labelKey: 'focus.ringtone.rsGlow', root: 207.65, scale: 'majorPentatonic', waveform: 'triangle', noteDur: 0.7, pattern: [9, 7, 4, 2], filterCutoff: 1900, attackFrac: 0.3, releaseFrac: 0.95, vibrato: { rate: 5, depth: 3 } },
  { id: 'rs-exhale', labelKey: 'focus.ringtone.rsExhale', root: 164.81, scale: 'minorPentatonic', waveform: 'sine', noteDur: 0.95, pattern: [10, 7, 3, 0], filterCutoff: 1600, attackFrac: 0.35, releaseFrac: 0.95, harmonyInterval: 3 },
  { id: 'rs-meadow', labelKey: 'focus.ringtone.rsMeadow', root: 246.94, scale: 'dorian', waveform: 'triangle', noteDur: 0.8, pattern: [7, 5, 2, 0], filterCutoff: 2100, attackFrac: 0.3, releaseFrac: 0.95 },
  { id: 'rs-hush', labelKey: 'focus.ringtone.rsHush', root: 185, scale: 'major', waveform: 'sine', noteDur: 1.1, pattern: [4, 2, 0, -1], filterCutoff: 1700, attackFrac: 0.35, releaseFrac: 0.96, vibrato: { rate: 4, depth: 2.5 } },
  { id: 'rs-still', labelKey: 'focus.ringtone.rsStill', root: 220, scale: 'lydian', waveform: 'sine', noteDur: 1.3, pattern: [7, 4, 0], filterCutoff: 2400, attackFrac: 0.3, releaseFrac: 0.96, harmonyInterval: 7 },
]
