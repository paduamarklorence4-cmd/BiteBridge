import { Stethoscope, Droplets, ShieldCheck, MessageCircleQuestion } from 'lucide-react'
import { SERVICES } from '../config'
import Reveal from './Reveal'

const ICONS = { Stethoscope, Droplets, ShieldCheck, MessageCircleQuestion }

export default function ServiceGrid() {
  return (
    <div className="grid-4">
      {SERVICES.map((s, i) => {
        const Icon = ICONS[s.icon] || Stethoscope
        const dir = i % 2 === 0 ? 'left' : 'right'
        return (
          <Reveal key={s.title} className="card service-card" dir={dir} delay={i * 110}>
            <span className="icon-wrap"><Icon size={22} strokeWidth={1.75} aria-hidden="true" /></span>
            <h3>{s.title}</h3>
            <p className="muted">{s.text}</p>
          </Reveal>
        )
      })}
    </div>
  )
}