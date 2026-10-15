// Generates noise sample-by-sample in real time (not a looped recording),
// so the signal never repeats no matter how long it plays.
export function createNoiseNode(audioCtx, color = 'white') {
  const bufferSize = 4096
  const node = audioCtx.createScriptProcessor(bufferSize, 1, 1)

  // Paul Kellet's pink-noise filter state.
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  // Brown-noise integrator state.
  let brownLast = 0

  node.onaudioprocess = (e) => {
    const out = e.outputBuffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1
      if (color === 'pink') {
        b0 = 0.99886 * b0 + white * 0.0555179
        b1 = 0.99332 * b1 + white * 0.0750759
        b2 = 0.96900 * b2 + white * 0.1538520
        b3 = 0.86650 * b3 + white * 0.3104856
        b4 = 0.55000 * b4 + white * 0.5329522
        b5 = -0.7616 * b5 - white * 0.0168980
        const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362
        b6 = white * 0.115926
        out[i] = pink * 0.11
      } else if (color === 'brown') {
        brownLast = (brownLast + 0.02 * white) / 1.02
        out[i] = brownLast * 3.5
      } else {
        out[i] = white * 0.6
      }
    }
  }

  return node
}
