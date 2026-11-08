import { CalendarClock } from 'lucide-react'
import { HOURS } from '../config'
import { useOpenState } from './OpenStatus'

export default function HoursTable() {
  const { today } = useOpenState()
  return (
    <div className="hours">
      <h3 className="hours-title">
        <CalendarClock size={20} strokeWidth={1.75} aria-hidden="true" /> Operating hours
      </h3>
      <table>
        <tbody>
          {HOURS.map((h) => (
            <tr key={h.day} className={today?.day === h.day ? 'is-today' : ''}>
              <th scope="row">{h.day}</th>
              <td>{h.label}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="hours-note">Times are in Philippine time.</p>
    </div>
  )
}
