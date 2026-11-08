import { useEffect, useRef } from 'react'

export default function StageBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let w = 0
    let h = 0
    let raf = 0

    // Malalambot na liwanag na gumagalaw
    const blobs = [
      { x: 0.15, y: 0.2, r: 0.42, c: [28, 127, 134], s: 0.00022, p: 0 },
      { x: 0.85, y: 0.45, r: 0.48, c: [85, 99, 232], s: 0.00018, p: 2 },
      { x: 0.4, y: 0.85, r: 0.38, c: [120, 190, 230], s: 0.00026, p: 4 },
      { x: 0.9, y: 0.95, r: 0.34, c: [28, 127, 134], s: 0.0002, p: 1 },
    ]

    // Mga maliliit na tuldok na lumulutang, iba-iba ang lalim
    const bokeh = Array.from({ length: 40 }, () => ({
      x: Math.random(),
      y: Math.random(),
      z: 0.3 + Math.random() * 0.9,
      r: 1.2 + Math.random() * 3.2,
      ph: Math.random() * Math.PI * 2,
    }))

    function resize() {
      w = canvas.parentElement.clientWidth
      h = canvas.parentElement.clientHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function draw(now) {
      const t = reduce ? 0 : now
      const off = -canvas.getBoundingClientRect().top
      ctx.clearRect(0, 0, w, h)

      for (const b of blobs) {
        const x = (b.x + Math.sin(t * b.s + b.p) * 0.08) * w
        const y = (b.y + Math.cos(t * b.s * 1.3 + b.p) * 0.06) * h + off * 0.12
        const R = b.r * Math.max(w, h)
        const g = ctx.createRadialGradient(x, y, 0, x, y, R)
        g.addColorStop(0, `rgba(${b.c.join(',')},0.28)`)
        g.addColorStop(1, `rgba(${b.c.join(',')},0)`)
        ctx.fillStyle = g
        ctx.fillRect(x - R, y - R, R * 2, R * 2)
      }

      for (const d of bokeh) {
        const drift = Math.sin(t * 0.0006 + d.ph) * 14 * d.z
        const x = d.x * w + drift
        let y = d.y * h - off * d.z * 0.35 - t * 0.00004 * d.z * h
        y = ((y % h) + h) % h
        ctx.beginPath()
        ctx.arc(x, y, d.r * d.z, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(14,42,71,${0.08 + d.z * 0.12})`
        ctx.fill()
      }

      if (!reduce) raf = requestAnimationFrame(draw)
    }

    const onScroll = () => { if (reduce) draw(0) }

    resize()
    raf = requestAnimationFrame(draw)
    window.addEventListener('resize', resize)
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('scroll', onScroll)
    }
  }, [])

  return <canvas ref={canvasRef} className="stage-canvas" aria-hidden="true" />
}