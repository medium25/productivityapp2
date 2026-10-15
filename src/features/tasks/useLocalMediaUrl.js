import { useEffect, useState } from 'react'
import { getLocalMedia } from '../../storage/localMedia'

// Resolves a message's mediaLocalKey to a blob: URL for <img>/<audio> src,
// on the device that actually has the blob in IndexedDB — see
// docs/superpowers/specs/2026-08-11-local-insights-media-design.md. Returns
// null both while loading and when the blob genuinely isn't here (e.g. a
// message synced in from another device), so MessageBubble can't tell the
// two apart from the return value alone and always renders its own loading
// state first.
export function useLocalMediaUrl(localKey) {
  const [url, setUrl] = useState(null)
  // Bumped when a blob for this key is saved later (e.g. uploaded by hand
  // from another device's download) so the bubble picks it up without a reload.
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!localKey) return undefined
    const onSaved = (e) => { if (e.detail === localKey) setVersion((v) => v + 1) }
    window.addEventListener('local-media-saved', onSaved)
    return () => window.removeEventListener('local-media-saved', onSaved)
  }, [localKey])

  useEffect(() => {
    if (!localKey) {
      setUrl(null)
      return
    }
    let cancelled = false
    let objectUrl = null
    setUrl(null)
    getLocalMedia(localKey).then((blob) => {
      if (cancelled || !blob) return
      objectUrl = URL.createObjectURL(blob)
      setUrl(objectUrl)
    })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [localKey, version])

  return url
}
