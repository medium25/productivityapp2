import { createNoiseNode } from './noiseSource'

// Trimmed down twice per user request — first to these 8, then a batch of
// 15 candidates was tried live in the app and narrowed to 4 keepers
// (deep-ocean, snow-hush, distant-thunder-calm, library-quiet).
export const AMBIENT_SOUNDS = [
  { id: 'sea-calm', group: 'ambient', labelKey: 'focus.sound.seaCalm' },
  { id: 'sea-waves', group: 'ambient', labelKey: 'focus.sound.seaWaves' },
  { id: 'ambient-wind', group: 'ambient', labelKey: 'focus.sound.ambientWind' },
  { id: 'ambient-pad', group: 'ambient', labelKey: 'focus.sound.ambientPad' },
  { id: 'brown-hum', group: 'ambient', labelKey: 'focus.sound.brownHum' },
  { id: 'thunderstorm', group: 'ambient', labelKey: 'focus.sound.thunderstorm' },
  { id: 'cafe-ambience', group: 'ambient', labelKey: 'focus.sound.cafeAmbience' },
  { id: 'forest-birds', group: 'ambient', labelKey: 'focus.sound.forestBirds' },
  { id: 'deep-ocean', group: 'ambient', labelKey: 'focus.sound.deepOcean' },
  { id: 'snow-hush', group: 'ambient', labelKey: 'focus.sound.snowHush' },
  { id: 'distant-thunder-calm', group: 'ambient', labelKey: 'focus.sound.distantThunderCalm' },
  { id: 'library-quiet', group: 'ambient', labelKey: 'focus.sound.libraryQuiet' },
  // The one non-synthesized sound in this file (see buildOldClockTickGraph
  // below) — per user request for "точно такой" (exactly this one), not a
  // synthesized approximation, after 10 synthesized clock-tick candidates
  // were previewed and none of them were quite right.
  { id: 'old-clock-tick', group: 'ambient', labelKey: 'focus.sound.oldClockTick' },
]

const makeFilter = (ctx, type, freq, q) => {
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  if (q) f.Q.value = q
  return f
}

const chain = (source, filters) => {
  let node = source
  filters.forEach((f) => {
    node.connect(f)
    node = f
  })
  return node
}

// Shared scheduler for anything that fires one-off events at random
// intervals (thunder rumbles, page rustles...) — same self-rescheduling
// setTimeout recipe throughout. Returns a stop function to push onto
// extraStops.
const scheduleLoop = (fn, minDelay, maxDelay) => {
  const marker = { stopped: false, timeoutId: null }
  const next = () => {
    if (marker.stopped) return
    const delay = minDelay + Math.random() * (maxDelay - minDelay)
    marker.timeoutId = setTimeout(() => {
      if (marker.stopped) return
      fn()
      next()
    }, delay)
  }
  next()
  return () => {
    marker.stopped = true
    if (marker.timeoutId) clearTimeout(marker.timeoutId)
  }
}

// A short, decaying noise burst — used by library-quiet's page rustle.
const playNoiseBurst = (ctx, destination, { duration, filterType, filterFreq, gain }) => {
  const t = ctx.currentTime
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
  const noise = ctx.createBufferSource()
  noise.buffer = buffer
  const filter = ctx.createBiquadFilter()
  filter.type = filterType
  filter.frequency.value = filterFreq
  const g = ctx.createGain()
  g.gain.value = gain
  noise.connect(filter)
  filter.connect(g)
  g.connect(destination)
  noise.start(t)
  noise.stop(t + duration)
}

const playThunderRumble = (ctx, destination) => {
  const t = ctx.currentTime
  const dur = 1.8 + Math.random() * 1.6
  const noise = createNoiseNode(ctx, 'brown')
  const filter = makeFilter(ctx, 'lowpass', 140, 0.6)
  const env = ctx.createGain()
  env.gain.setValueAtTime(0.0001, t)
  env.gain.linearRampToValueAtTime(0.5 + Math.random() * 0.3, t + 0.3)
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  noise.connect(filter)
  filter.connect(env)
  env.connect(destination)
  setTimeout(() => { try { noise.disconnect() } catch { /* already gone */ } }, dur * 1000 + 200)
}

const playBirdChirp = (ctx, destination) => {
  const t = ctx.currentTime
  const baseFreq = 2200 + Math.random() * 1800
  const dur = 0.12 + Math.random() * 0.1
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(baseFreq, t)
  osc.frequency.exponentialRampToValueAtTime(baseFreq * (1.4 + Math.random() * 0.5), t + dur * 0.5)
  osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.8, t + dur)
  const env = ctx.createGain()
  env.gain.setValueAtTime(0.0001, t)
  env.gain.linearRampToValueAtTime(0.18, t + 0.015)
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(env)
  env.connect(destination)
  osc.start(t)
  osc.stop(t + dur + 0.05)
  // A real bird rarely sings just once — occasionally follow up with a
  // quick second chirp instead of scheduling a whole separate loop for it.
  if (Math.random() < 0.4) {
    setTimeout(() => playBirdChirp(ctx, destination), 90 + Math.random() * 120)
  }
}

const playPageRustle = (ctx, destination) => {
  playNoiseBurst(ctx, destination, {
    duration: 0.3 + Math.random() * 0.2,
    filterType: 'bandpass',
    filterFreq: 2500,
    gain: 0.1,
  })
}

// The one real recording in this file (see AMBIENT_SOUNDS' own comment on
// why) — everything else here is synthesized. Decoded once and cached
// module-wide (an AudioBuffer isn't tied to the context that decoded it —
// safe to reuse across plays, and across a getAudioContext() reset, since
// the app only ever runs one AudioContext at a time anyway) so switching
// this sound on and off repeatedly doesn't re-fetch/re-decode the file
// every time.
let clockTickBufferPromise = null
function loadClockTickBuffer(ctx) {
  if (!clockTickBufferPromise) {
    clockTickBufferPromise = fetch('/sounds/old-clock-tick.mp3')
      .then((res) => res.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))
      .catch((err) => {
        console.error('Failed to load old-clock-tick.mp3', err)
        clockTickBufferPromise = null // let the next play() attempt retry
        throw err
      })
  }
  return clockTickBufferPromise
}

// The clip is a single tick+tock pair (~1s apart) with a couple hundred ms
// of near-silent tail after the tock — recorded that way on purpose so the
// whole 2s buffer loops seamlessly back into itself with no click or gap
// at the seam, producing an even, continuous tick-tock instead of a single
// one-shot hit repeated on a synthetic timer.
function buildOldClockTickGraph(ctx) {
  const bus = ctx.createGain()
  bus.gain.value = 1
  let cancelled = false
  let source = null

  loadClockTickBuffer(ctx).then((buffer) => {
    if (cancelled) return
    source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.connect(bus)
    source.start()
  })

  const stopSource = () => {
    cancelled = true
    if (source) {
      try { source.stop() } catch { /* already stopped */ }
      try { source.disconnect() } catch { /* already disconnected */ }
    }
  }

  return { output: bus, stopSource }
}

// Builds a fresh, live audio graph for the given ambient sound id. Every
// sound is synthesized in real time and never audibly repeats, however
// long a session runs — except 'old-clock-tick' (see buildOldClockTickGraph
// above), the one real recording, which loops.
export function buildAmbientGraph(ctx, id) {
  const cleanup = []
  const extraStops = []
  let output

  const track = (node) => {
    cleanup.push(node)
    return node
  }

  switch (id) {
    case 'sea-calm': {
      const src = track(createNoiseNode(ctx, 'brown'))
      const filtered = chain(src, [makeFilter(ctx, 'lowpass', 450, 0.8)])
      const swell = ctx.createGain()
      swell.gain.value = 0.6
      filtered.connect(swell)
      const lfo = track(ctx.createOscillator())
      lfo.frequency.value = 0.07
      const lfoGain = ctx.createGain()
      lfoGain.gain.value = 0.35
      lfo.connect(lfoGain)
      lfoGain.connect(swell.gain)
      lfo.start()
      output = swell
      break
    }

    case 'sea-waves': {
      const src = track(createNoiseNode(ctx, 'brown'))
      const filtered = chain(src, [makeFilter(ctx, 'lowpass', 650, 0.9)])
      const swell = ctx.createGain()
      swell.gain.value = 0.6
      filtered.connect(swell)
      const lfo = track(ctx.createOscillator())
      lfo.frequency.value = 0.16
      const lfoGain = ctx.createGain()
      lfoGain.gain.value = 0.45
      lfo.connect(lfoGain)
      lfoGain.connect(swell.gain)
      lfo.start()
      output = swell
      break
    }

    case 'ambient-wind': {
      const src = track(createNoiseNode(ctx, 'pink'))
      const filter = makeFilter(ctx, 'bandpass', 420, 0.6)
      src.connect(filter)
      const lfo = track(ctx.createOscillator())
      lfo.frequency.value = 0.05
      const lfoGain = ctx.createGain()
      lfoGain.gain.value = 180
      lfo.connect(lfoGain)
      lfoGain.connect(filter.frequency)
      lfo.start()
      output = filter
      break
    }

    case 'ambient-pad': {
      const bus = ctx.createGain()
      bus.gain.value = 0.5
      const freqs = [110, 130.81, 164.81, 220]
      freqs.forEach((f, i) => {
        const osc = track(ctx.createOscillator())
        osc.type = 'sine'
        osc.frequency.value = f
        const g = ctx.createGain()
        g.gain.value = 0.2
        osc.connect(g)
        g.connect(bus)
        osc.start()

        const lfo = track(ctx.createOscillator())
        lfo.frequency.value = 0.03 + i * 0.007
        const lfoGain = ctx.createGain()
        lfoGain.gain.value = 0.08
        lfo.connect(lfoGain)
        lfoGain.connect(g.gain)
        lfo.start()
      })
      const filter = makeFilter(ctx, 'lowpass', 900, 0.5)
      bus.connect(filter)
      output = filter
      break
    }

    case 'brown-hum': {
      // Steady, no LFO on purpose — a fan/engine drone reads as constant,
      // not swelling like the sea variants.
      const src = track(createNoiseNode(ctx, 'brown'))
      output = chain(src, [makeFilter(ctx, 'lowpass', 220, 0.7)])
      break
    }

    case 'thunderstorm': {
      const src = track(createNoiseNode(ctx, 'pink'))
      const rainOut = chain(src, [makeFilter(ctx, 'highpass', 700), makeFilter(ctx, 'lowpass', 3000, 0.5)])
      const bus = ctx.createGain()
      bus.gain.value = 1
      rainOut.connect(bus)
      extraStops.push(scheduleLoop(() => playThunderRumble(ctx, bus), 9000, 22000))
      output = bus
      break
    }

    case 'cafe-ambience': {
      const src = track(createNoiseNode(ctx, 'pink'))
      const filtered = chain(src, [makeFilter(ctx, 'lowpass', 1400, 0.4), makeFilter(ctx, 'highpass', 150)])
      const bus = ctx.createGain()
      bus.gain.value = 0.7
      filtered.connect(bus)
      const lfo = track(ctx.createOscillator())
      lfo.frequency.value = 0.09
      const lfoGain = ctx.createGain()
      lfoGain.gain.value = 0.18
      lfo.connect(lfoGain)
      lfoGain.connect(bus.gain)
      lfo.start()
      output = bus
      break
    }

    case 'forest-birds': {
      const src = track(createNoiseNode(ctx, 'pink'))
      const bed = chain(src, [makeFilter(ctx, 'bandpass', 700, 0.5)])
      const bedGain = ctx.createGain()
      bedGain.gain.value = 0.18
      const bus = ctx.createGain()
      bus.gain.value = 1
      bed.connect(bedGain)
      bedGain.connect(bus)
      extraStops.push(scheduleLoop(() => playBirdChirp(ctx, bus), 1800, 6000))
      output = bus
      break
    }

    case 'deep-ocean': {
      const src = track(createNoiseNode(ctx, 'brown'))
      const filtered = chain(src, [makeFilter(ctx, 'lowpass', 150, 0.7)])
      const swell = ctx.createGain()
      swell.gain.value = 0.55
      filtered.connect(swell)
      const lfo = track(ctx.createOscillator())
      lfo.frequency.value = 0.03
      const lfoGain = ctx.createGain()
      lfoGain.gain.value = 0.25
      lfo.connect(lfoGain)
      lfoGain.connect(swell.gain)
      lfo.start()
      output = swell
      break
    }

    case 'snow-hush': {
      const src = track(createNoiseNode(ctx, 'white'))
      const filtered = chain(src, [makeFilter(ctx, 'lowpass', 3200, 0.4), makeFilter(ctx, 'highpass', 200)])
      const bus = ctx.createGain()
      bus.gain.value = 0.14
      filtered.connect(bus)
      output = bus
      break
    }

    case 'distant-thunder-calm': {
      const bed = track(createNoiseNode(ctx, 'brown'))
      const bedOut = chain(bed, [makeFilter(ctx, 'lowpass', 200, 0.6)])
      const bus = ctx.createGain()
      bus.gain.value = 1
      const bedGain = ctx.createGain()
      bedGain.gain.value = 0.06
      bedOut.connect(bedGain)
      bedGain.connect(bus)
      extraStops.push(scheduleLoop(() => playThunderRumble(ctx, bus), 15000, 35000))
      output = bus
      break
    }

    case 'library-quiet': {
      const src = track(createNoiseNode(ctx, 'pink'))
      const filtered = chain(src, [makeFilter(ctx, 'lowpass', 900, 0.4)])
      const bus = ctx.createGain()
      bus.gain.value = 0.12
      filtered.connect(bus)
      extraStops.push(scheduleLoop(() => playPageRustle(ctx, bus), 25000, 60000))
      output = bus
      break
    }

    case 'old-clock-tick': {
      const { output: busOut, stopSource } = buildOldClockTickGraph(ctx)
      extraStops.push(stopSource)
      output = busOut
      break
    }

    default: {
      const filter = makeFilter(ctx, 'lowpass', 900, 0.5)
      track(createNoiseNode(ctx, 'pink')).connect(filter)
      output = filter
    }
  }

  const stop = () => {
    extraStops.forEach((fn) => fn())
    cleanup.forEach((node) => {
      try { node.stop && node.stop() } catch { /* already stopped */ }
      try { node.disconnect() } catch { /* already disconnected */ }
    })
  }

  return { output, stop }
}
