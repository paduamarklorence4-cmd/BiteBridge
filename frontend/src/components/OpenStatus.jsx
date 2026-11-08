import { useEffect, useState } from 'react'
import { HOURS } from '../config'

const DOW = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }

function manilaNow() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(new Date())
  const get = (t) => parts.find((p) => p.type === t)?.value
  return {
    dow: DOW[get('weekday')],
    minutes: (parseInt(get('hour'), 10) % 24) * 60 + parseInt(get('minute'), 10),
  }
}

export function useOpenState() {
  const [state, setState] = useState(() => compute())
  useEffect(() => {
    const id = setInterval(() => setState(compute()), 60000)
    return () => clearInterval(id)
  }, [])
  return state
}

function compute() {
  const { dow, minutes } = manilaNow()
  const today = HOURS.find((h) => h.dow === dow)
  return { isOpen: !!today && minutes >= today.open && minutes < today.close, today }
}

export default function OpenStatus() {
  const { isOpen, today } = useOpenState()
  return (
    <span className={`status ${isOpen ? 'status-open' : 'status-closed'}`}>
      <span className="status-dot" aria-hidden="true" />
      {isOpen ? 'Open now' : 'Closed now'}
      <span className="status-note"> · Today: {today?.label}</span>
    </span>
  )
}
