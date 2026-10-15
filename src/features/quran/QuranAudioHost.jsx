import { useEffect } from 'react'
import { ensureQuranEngine } from '../../audio/quranAudioEngine'

// Mounted once, high in the tree (App's Layout), for the whole signed-in
// session. Starts the module-singleton recitation engine so audio keeps
// playing across route changes. Renders nothing.
export default function QuranAudioHost() {
  useEffect(() => {
    ensureQuranEngine()
  }, [])
  return null
}
