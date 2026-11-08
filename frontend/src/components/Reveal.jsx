import { useEffect, useRef } from 'react'

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const easeOut = (t) => 1 - Math.pow(1 - t, 3)

// Scroll-linked na animation para sa lahat ng page.
// dir: 'left' | 'right' | 'up' | 'zoom'
// Ang --t ay 0 kapag wala pa sa screen, 1 kapag nasa gitna. Uulit sa bawat scroll.
export default function Reveal({ children, delay = 0, as: Tag = 'div', className = '', dir = 'up' }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0

    const update = () => {
      raf = 0
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight
      const enter = clamp((vh - r.top) / (vh * 0.8) - delay / 3000)
      const exit = clamp(r.bottom / (vh * 0.4))
      const t = reduce ? 1 : Math.min(enter, exit)
      el.style.setProperty('--t', easeOut(t).toFixed(3))
    }
    const request = () => { if (!raf) raf = requestAnimationFrame(update) }

    update()
    window.addEventListener('scroll', request, { passive: true })
    window.addEventListener('resize', request)
    return () => {
      window.removeEventListener('scroll', request)
      window.removeEventListener('resize', request)
      cancelAnimationFrame(raf)
    }
  }, [delay])

  return (
    <Tag ref={ref} className={`reveal reveal-${dir} ${className}`}>
      {children}
    </Tag>
  )
}