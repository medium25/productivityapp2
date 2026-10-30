// Three-way merge of one persisted store document, used when another device changed the
// document in the cloud after this device last read it (so a plain overwrite would erase
// that device's work). `base` is what this device last saw in the cloud (or null), `server`
// is what is there now, `local` is what this device wants to save.
//
// Per top-level state field:
//  - array of {id} records: merged record by record — a record this device did not touch takes
//    the cloud's version, one it changed keeps this device's, records new on either side are
//    kept, records one side deleted stay deleted (unless the other side changed them);
//  - anything else: this device's value if it changed it, otherwise the cloud's.

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const isRecordList = (v) => Array.isArray(v) && v.every((x) => x && typeof x === 'object' && 'id' in x)

function mergeRecords(base, server, local) {
  const baseById = new Map((base || []).map((r) => [r.id, r]))
  const serverById = new Map(server.map((r) => [r.id, r]))
  const localById = new Map(local.map((r) => [r.id, r]))
  const out = []
  const seen = new Set()
  const pushPick = (id) => {
    const b = baseById.get(id)
    const s = serverById.get(id)
    const l = localById.get(id)
    seen.add(id)
    if (s && l) {
      if (b && same(l, b)) out.push(s) // untouched here → cloud's version
      else out.push(l) // changed here (or unknown) → this device's version
    } else if (s && !l) {
      // deleted here — unless the cloud changed it meanwhile, or this device never had it (new there)
      if (!b) out.push(s)
      else if (!same(s, b)) out.push(s)
    } else if (!s && l) {
      // deleted in the cloud — unless this device changed it, or it is new here
      if (!b) out.push(l)
      else if (!same(l, b)) out.push(l)
    }
  }
  server.forEach((r) => pushPick(r.id)) // the cloud's order first
  local.forEach((r) => { if (!seen.has(r.id)) pushPick(r.id) })
  return out
}

export function mergeDocs(base, server, local) {
  const bs = base?.state && typeof base.state === 'object' ? base.state : null
  const ss = server?.state && typeof server.state === 'object' ? server.state : {}
  const ls = local?.state && typeof local.state === 'object' ? local.state : {}
  const state = {}
  const keys = new Set([...Object.keys(ss), ...Object.keys(ls)])
  keys.forEach((k) => {
    const s = ss[k]
    const l = ls[k]
    const b = bs ? bs[k] : undefined
    if (k in ls && k in ss && isRecordList(s) && isRecordList(l) && (b === undefined || isRecordList(b))) {
      state[k] = mergeRecords(b, s, l)
    } else if (!(k in ls)) {
      state[k] = s
    } else if (!(k in ss)) {
      state[k] = l
    } else if (bs && same(l, b)) {
      state[k] = s
    } else {
      state[k] = l
    }
  })
  return { version: local?.version ?? server?.version ?? 0, state }
}
