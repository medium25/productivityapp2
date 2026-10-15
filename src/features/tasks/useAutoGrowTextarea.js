import { useEffect, useRef } from 'react'

// Grows a textarea to fit its content as the user types — instead of text
// scrolling inside a fixed single-line box, the box itself gets taller (up
// to the CSS max-height, after which it scrolls normally). Shared by the
// various quick-add rows and the Insights composer, all of which want the
// same behavior.
export function useAutoGrowTextarea(value) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [value])

  return ref
}
