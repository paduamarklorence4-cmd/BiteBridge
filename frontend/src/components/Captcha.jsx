import { useState, useEffect } from 'react'
import { RefreshCw, ShieldCheck, Check } from 'lucide-react'

const PIECE_W = 20    // lapad ng piece, % ng larawan
const PIECE_H = 40    // taas ng piece, % ng larawan
const TOP = 28        // layo ng butas mula sa itaas, %
const TOLERANCE = 1.2 // gaano kalapit para tama

const rand = (a, b) => a + Math.random() * (b - a)

// Bagong litrato sa bawat captcha (random seed).
function photoUrl() {
  const seed = Math.random().toString(36).slice(2, 10)
  return `https://picsum.photos/seed/${seed}/640/400`
}

// Fallback kung walang internet.
function gradientFallback() {
  const h = Math.floor(rand(0, 360))
  return `linear-gradient(hsl(${h} 55% 40%), hsl(${(h + 60) % 360} 60% 72%))`
}

function makePuzzle() {
  return {
    image: photoUrl(),
    fallback: gradientFallback(),
    target: rand(12, 100 - PIECE_W - 8),
  }
}

export default function Captcha({ onVerified }) {
  const [phase, setPhase] = useState('idle') // idle | checking | challenge | done
  const [puzzle, setPuzzle] = useState(makePuzzle)
  const [value, setValue] = useState(0)
  const [failed, setFailed] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (phase !== 'checking') return
    const t = setTimeout(() => setPhase('challenge'), 1500)
    return () => clearTimeout(t)
  }, [phase])

  function start() {
    if (phase === 'idle') setPhase('checking')
  }

  function newPuzzle() {
    setPuzzle(makePuzzle())
    setValue(0)
    setFailed(false)
    setMsg('')
  }

  // Tinatawag kapag binitawan ang slider o pinindot ang Enter.
  function release() {
    if (phase !== 'challenge' || value === 0) return
    if (Math.abs(value - puzzle.target) <= TOLERANCE) {
      setPhase('done')
      setMsg('')
      onVerified()
    } else {
      newPuzzle()
      setMsg('Not quite. Please try again.')
    }
  }

  if (phase !== 'challenge') {
    const checked = phase === 'done'
    return (
      <div
        className="rc-box"
        role="checkbox"
        aria-checked={checked}
        tabIndex={0}
        onClick={start}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); start() }
        }}
      >
        <div className="rc-left">
          <span className={`rc-check ${checked ? 'is-done' : ''}`}>
            {phase === 'checking' && <span className="rc-spin" />}
            {checked && <Check size={22} strokeWidth={3} aria-hidden="true" />}
          </span>
          <span>I'm not a robot</span>
        </div>
        <div className="rc-logo">
          <ShieldCheck size={30} strokeWidth={1.5} color="#0e2a47" aria-hidden="true" />
          <span>BiteBridge check</span>
        </div>
      </div>
    )
  }

  const bg = failed ? puzzle.fallback : `url("${puzzle.image}")`

  return (
    <div className="rc-chal">
      <img src={puzzle.image} alt="" style={{ display: 'none' }} onError={() => setFailed(true)} />

      <div className="rc-head">
        <span>Verify you are human</span>
        <button type="button" className="rc-refresh" onClick={newPuzzle} aria-label="New picture">
          <RefreshCw size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      <div className="rc-scene" style={{ backgroundImage: bg }}>
        <div
          className="rc-hole"
          style={{ left: `${puzzle.target}%`, top: `${TOP}%`, width: `${PIECE_W}%`, height: `${PIECE_H}%` }}
        />
        <div
          className="rc-piece"
          style={{
            left: `${value}%`,
            top: `${TOP}%`,
            width: `${PIECE_W}%`,
            height: `${PIECE_H}%`,
            backgroundImage: bg,
            backgroundSize: `${(100 / PIECE_W) * 100}% ${(100 / PIECE_H) * 100}%`,
            backgroundPosition: `${puzzle.target * 1.25}% ${(TOP / 60) * 100}%`,
          }}
        />
      </div>

      <div className="rc-foot">
        <p className="rc-instr">Slide right to complete the puzzle.</p>
        <input
          type="range"
          className="rc-slider"
          min="0"
          max={100 - PIECE_W}
          step="0.1"
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          onPointerUp={release}
          onKeyUp={(e) => { if (e.key === 'Enter' || e.key === ' ') release() }}
          aria-label="Slide to complete the puzzle"
        />
        {msg && <p className="rc-msg" role="alert">{msg}</p>}
      </div>
    </div>
  )
}