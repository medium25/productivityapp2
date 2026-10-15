// A note is stored as one string. A photo sits on its own line as a marker,
// [[img:<id>]], and the picture itself lives in this device's IndexedDB under
// that id (see storage/localMedia.js). Everything around the markers is plain
// text, so notes written before photos existed open unchanged.
const MARKER = /\n?\[\[img:([\w-]+)\]\]\n?/g

// text -> [{type:'text', value}, {type:'img', id}, {type:'text', value}, ...]
// Always starts and ends with a text block, so there is a place to type before
// and after every photo.
export function parseBlocks(text) {
  const blocks = []
  let last = 0
  const src = text || ''
  for (const m of src.matchAll(MARKER)) {
    blocks.push({ type: 'text', value: src.slice(last, m.index) })
    blocks.push({ type: 'img', id: m[1] })
    last = m.index + m[0].length
  }
  blocks.push({ type: 'text', value: src.slice(last) })
  return blocks
}

export function serializeBlocks(blocks) {
  return blocks
    .map((b, i) => {
      if (b.type === 'img') return `[[img:${b.id}]]`
      const prevImg = blocks[i - 1]?.type === 'img'
      const nextImg = blocks[i + 1]?.type === 'img'
      return (prevImg ? '\n' : '') + b.value + (nextImg ? '\n' : '')
    })
    .join('')
}

export function imageIds(text) {
  return [...(text || '').matchAll(MARKER)].map((m) => m[1])
}

// Plain text for card previews: markers dropped.
export function stripImages(text) {
  return stripHeadings((text || '').replace(MARKER, '\n')).trim()
}

// Heading lines are stored with a "# " / "## " / "### " prefix.
export function stripHeadings(text) {
  return (text || '').replace(/^#{1,3}~? /gm, '')
}
