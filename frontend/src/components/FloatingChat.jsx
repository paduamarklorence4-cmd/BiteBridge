import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

function BotIcon() {
  return (
    <svg viewBox="0 0 120 120" width="100%" height="100%" aria-hidden="true">
      {/* antennas */}
      <line x1="46" y1="34" x2="40" y2="20" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <line x1="74" y1="34" x2="80" y2="20" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <circle cx="40" cy="18" r="4" fill="#fff" />
      <circle cx="80" cy="18" r="4" fill="#fff" />
      {/* white helmet shell */}
      <rect x="30" y="30" width="60" height="50" rx="22" fill="#fff" />
      {/* dark visor */}
      <rect x="37" y="40" width="46" height="32" rx="14" fill="#1d2a80" />
      {/* eyes */}
      <circle cx="50" cy="54" r="3.4" fill="#fff" />
      <circle cx="70" cy="54" r="3.4" fill="#fff" />
      {/* smile */}
      <path d="M52 63 Q60 69 68 63" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      {/* ear pads */}
      <rect x="22" y="50" width="10" height="20" rx="5" fill="#fff" />
      <rect x="88" y="50" width="10" height="20" rx="5" fill="#fff" />
      {/* body */}
      <path d="M36 82 Q60 74 84 82 Q92 92 92 104 Q92 112 60 112 Q28 112 28 104 Q28 92 36 82 Z" fill="#fff" />
    </svg>
  )
}

export default function FloatingChat() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(true)
  if (pathname.startsWith('/chat')) return null

  return (
    <div className="fchat-wrap">
      {open && (
        <div className="fchat-bubble" role="dialog" aria-label="BiteBridge greeting">
          <button type="button" className="fchat-close" onClick={() => setOpen(false)} aria-label="Hide message">×</button>
          <p>Hi, how can I help you Today!</p>
        </div>
      )}
      <Link to="/chat" className="fchat-btn" aria-label="Chat with BiteBridge">
        <span className="fchat-ring fchat-ring-2" aria-hidden="true" />
        <span className="fchat-ring fchat-ring-1" aria-hidden="true" />
        <span className="fchat-ai" aria-hidden="true">Ai</span>
        <span className="fchat-circle">
          <BotIcon />
        </span>
      </Link>
    </div>
  )
}