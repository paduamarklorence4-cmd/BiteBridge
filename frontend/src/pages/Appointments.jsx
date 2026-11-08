import { useState } from 'react'
import ResourcePage, { Badge, errorMessage, fmtDate, label, todayStr } from '../components/ResourcePage'
import { staffPost } from '../services/staffApi'

const statuses = ['scheduled', 'completed', 'cancelled', 'rescheduled', 'no_show']
const tone = { scheduled: 'navy', completed: 'green', cancelled: 'gray', rescheduled: 'amber', no_show: 'red' }
const time = (t) => (t ? String(t).slice(0, 5) : '—')

function Reschedule({ row, ctx }) {
  const [date, setDate] = useState('')
  const [tm, setTm] = useState(row.appointment_time ? String(row.appointment_time).slice(0, 5) : '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!date) { setError('Choose the new date.'); return }
    setSaving(true); setError(null)
    try {
      await staffPost('/appointments/reschedule', { id: row.id, appointment_date: date, appointment_time: tm })
      ctx.done('Appointment rescheduled.')
    } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }
  return (
    <form onSubmit={submit}>
      {error && <div className="pt-error" role="alert">{error}</div>}
      <p><strong>{row.patient_name}</strong><br />Now: {fmtDate(row.appointment_date)} {time(row.appointment_time)}, {row.purpose}</p>
      <div className="pt-form">
        <div className="pt-field"><label htmlFor="rs-date">New date *</label><input id="rs-date" type="date" min={todayStr()} value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="pt-field"><label htmlFor="rs-time">New time</label><input id="rs-time" type="time" value={tm} onChange={(e) => setTm(e.target.value)} /></div>
      </div>
      <p className="pt-hint">The old appointment is marked as rescheduled and a new one is created.</p>
      <div className="pt-form-actions">
        <button type="button" className="btn btn-outline" onClick={ctx.close} disabled={saving}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Reschedule'}</button>
      </div>
    </form>
  )
}

function CancelAppt({ row, ctx }) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  async function submit(e) {
    e.preventDefault()
    if (!reason.trim()) { setError('Enter the reason for cancelling.'); return }
    setSaving(true); setError(null)
    try {
      await staffPost('/appointments/cancel', { id: row.id, reason })
      ctx.done('Appointment cancelled.')
    } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }
  return (
    <form onSubmit={submit}>
      {error && <div className="pt-error" role="alert">{error}</div>}
      <p><strong>{row.patient_name}</strong><br />{fmtDate(row.appointment_date)} {time(row.appointment_time)}, {row.purpose}</p>
      <div className="pt-field"><label htmlFor="ca-reason">Reason *</label><input id="ca-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={255} /></div>
      <div className="pt-form-actions">
        <button type="button" className="btn btn-outline" onClick={ctx.close} disabled={saving}>Keep appointment</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Cancel appointment'}</button>
      </div>
    </form>
  )
}

const cfg = {
  title: 'Appointments',
  subtitle: 'Walk-in and booked appointments.',
  singular: 'appointment',
  base: '/appointments',
  perms: { view: 'appointments.view', manage: 'appointments.manage' },
  searchPlaceholder: 'Search patient, code, or purpose',
  filters: [
    { key: 'when', label: 'When', options: [{ value: 'today', label: 'Today' }, { value: 'upcoming', label: 'Upcoming' }, { value: 'past', label: 'Past' }] },
    { key: 'status', label: 'Status', options: statuses.map((v) => ({ value: v, label: label(v) })) },
  ],
  columns: [
    { key: 'patient_name', label: 'Patient', render: (r) => (<><strong>{r.patient_name}</strong><div className="pt-hint">{r.patient_code}</div></>) },
    { key: 'appointment_date', label: 'Date', type: 'date' },
    { key: 'appointment_time', label: 'Time', render: (r) => time(r.appointment_time) },
    { key: 'appointment_type', label: 'Type', render: (r) => <Badge tone={r.appointment_type === 'walk_in' ? 'amber' : 'navy'}>{r.appointment_type === 'walk_in' ? 'Walk-in' : 'Booked'}</Badge> },
    { key: 'purpose', label: 'Purpose' },
    { key: 'status', label: 'Status', render: (r) => <Badge tone={tone[r.status] || 'gray'}>{label(r.status)}</Badge> },
  ],
  fields: [
    { key: 'patient_id', label: 'Patient', type: 'ref', lookup: 'patients', labelKey: 'patient_label', required: true },
    { key: 'appointment_type', label: 'Type', type: 'select', options: [{ value: 'booked', label: 'Booked' }, { value: 'walk_in', label: 'Walk-in' }] },
    { key: 'appointment_date', label: 'Date', type: 'date', required: true },
    { key: 'appointment_time', label: 'Time', type: 'time' },
    { key: 'purpose', label: 'Purpose', type: 'text', maxLength: 150, required: true, hint: 'For example: consultation, vaccination dose, follow-up' },
    { key: 'status', label: 'Status', type: 'select', options: statuses.map((v) => ({ value: v, label: label(v) })) },
    { key: 'cancel_reason', label: 'Cancel reason', type: 'text', maxLength: 255, hint: 'Required when the status is cancelled.' },
  ],
  details: [
    { key: 'patient_name', label: 'Patient' }, { key: 'appointment_type', label: 'Type', type: 'enum' },
    { key: 'appointment_date', label: 'Date', type: 'date' }, { key: 'appointment_time', label: 'Time', render: (r) => time(r.appointment_time) },
    { key: 'purpose', label: 'Purpose' }, { key: 'status', label: 'Status', type: 'enum' }, { key: 'cancel_reason', label: 'Cancel reason' },
  ],
  actions: [
    { label: 'Reschedule', perm: 'appointments.manage', title: 'Reschedule appointment', show: (r) => r.status === 'scheduled', render: (row, ctx) => <Reschedule row={row} ctx={ctx} /> },
    { label: 'Cancel', perm: 'appointments.manage', title: 'Cancel appointment', show: (r) => r.status === 'scheduled', render: (row, ctx) => <CancelAppt row={row} ctx={ctx} /> },
  ],
}

export default function Appointments() {
  return <ResourcePage cfg={cfg} />
}