import ResourcePage, { Badge, fmtDate, fmtDateTime, label } from '../components/ResourcePage'
import TabbedPage from '../components/TabbedPage'

const patientCol = { key: 'patient_name', label: 'Patient', render: (r) => (<><strong>{r.patient_name}</strong><div className="pt-hint">{r.patient_code}</div></>) }
const tone = { scheduled: 'navy', completed: 'green', missed: 'red', cancelled: 'gray', pending: 'amber', sent: 'navy', delivered: 'green', failed: 'red' }

function dueText(r) {
  if (r.status !== 'scheduled') return null
  const n = Number(r.days_until)
  if (n === 0) return 'Due today'
  return n > 0 ? `In ${n} day${n === 1 ? '' : 's'}` : `${-n} day${n === -1 ? '' : 's'} overdue`
}

const schedule = {
  title: 'Vaccination schedule',
  subtitle: 'Follow-up tracker. Doses are set by the nurse or physician. Overdue doses are listed first.',
  singular: 'schedule',
  base: '/vaccination-schedules',
  perms: { view: 'vaccinations.view', manage: 'vaccinations.manage' },
  searchPlaceholder: 'Search patient, code, or contact number',
  filters: [{
    key: 'view', label: 'Show',
    options: [
      { value: 'overdue', label: 'Overdue' }, { value: 'upcoming', label: 'Due in the next 7 days' },
      { value: 'scheduled', label: 'All scheduled' }, { value: 'completed', label: 'Completed' }, { value: 'missed', label: 'Missed' },
    ],
  }],
  columns: [
    patientCol,
    { key: 'dose_number', label: 'Dose', render: (r) => `Dose ${r.dose_number}` },
    { key: 'scheduled_date', label: 'Date', type: 'date' },
    { key: 'status', label: 'Status', render: (r) => (
      <>
        <Badge tone={Number(r.is_overdue) === 1 ? 'red' : tone[r.status] || 'gray'}>{Number(r.is_overdue) === 1 ? 'Overdue' : label(r.status)}</Badge>
        {dueText(r) && <div className="pt-hint">{dueText(r)}</div>}
      </>
    ) },
    { key: 'contact_number', label: 'Contact' },
  ],
  fields: [
    { key: 'incident_id', label: 'Bite incident', type: 'ref', lookup: 'incidents', labelKey: 'incident_label', required: true },
    { key: 'dose_number', label: 'Dose number', type: 'number', maxLength: 2, required: true, hint: 'Whole number, for example 0, 3, 7.' },
    { key: 'scheduled_date', label: 'Scheduled date', type: 'date', required: true },
    { key: 'status', label: 'Status', type: 'select', options: ['scheduled', 'completed', 'missed', 'cancelled'].map((v) => ({ value: v, label: label(v) })) },
    { key: 'follow_up_notes', label: 'Follow-up notes', type: 'textarea' },
  ],
  details: [
    { key: 'patient_name', label: 'Patient' }, { key: 'incident_label', label: 'Incident' },
    { key: 'dose_number', label: 'Dose' }, { key: 'scheduled_date', label: 'Scheduled date', type: 'date' },
    { key: 'status', label: 'Status', type: 'enum' }, { key: 'contact_number', label: 'Contact number' },
    { key: 'follow_up_notes', label: 'Follow-up notes' },
  ],
}

const records = {
  title: 'Vaccination records',
  subtitle: 'Doses that were given. Saving a dose marks its schedule as completed and adds the next dose to the schedule.',
  singular: 'vaccination record',
  base: '/vaccination-records',
  perms: { view: 'vaccinations.view', manage: 'vaccinations.manage' },
  searchPlaceholder: 'Search patient, code, or vaccine',
  columns: [
    patientCol,
    { key: 'vaccine_name', label: 'Vaccine' },
    { key: 'dose_number', label: 'Dose' },
    { key: 'administered_date', label: 'Date given', type: 'date' },
    { key: 'next_scheduled_date', label: 'Next dose', type: 'date' },
    { key: 'administered_by_name', label: 'Given by' },
  ],
  fields: [
    { key: 'incident_id', label: 'Bite incident', type: 'ref', lookup: 'incidents', labelKey: 'incident_label', required: true },
    { key: 'vaccine_name', label: 'Vaccine', type: 'text', maxLength: 100, required: true },
    { key: 'dose_number', label: 'Dose number', type: 'number', maxLength: 2, required: true },
    { key: 'administered_date', label: 'Date given', type: 'date', noFuture: true, required: true },
    { key: 'next_scheduled_date', label: 'Next dose date', type: 'date' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
  details: [
    { key: 'patient_name', label: 'Patient' }, { key: 'incident_label', label: 'Incident' },
    { key: 'vaccine_name', label: 'Vaccine' }, { key: 'dose_number', label: 'Dose' },
    { key: 'administered_date', label: 'Date given', type: 'date' }, { key: 'next_scheduled_date', label: 'Next dose', type: 'date' },
    { key: 'administered_by_name', label: 'Given by' }, { key: 'notes', label: 'Notes' },
  ],
}

const reminders = {
  title: 'Reminder history',
  subtitle: 'SMS reminders. No SMS gateway has been configured or tested yet, so nothing is sent from this system.',
  singular: 'reminder',
  base: '/vaccination-reminders',
  readOnly: true,
  perms: { view: 'vaccinations.view', manage: 'vaccinations.manage' },
  searchPlaceholder: 'Search patient, code, or contact number',
  filters: [{ key: 'status', label: 'Status', options: ['pending', 'sent', 'delivered', 'failed', 'cancelled'].map((v) => ({ value: v, label: label(v) })) }],
  columns: [
    patientCol,
    { key: 'contact_number', label: 'Contact' },
    { key: 'scheduled_for', label: 'Planned send', type: 'datetime' },
    { key: 'status', label: 'Status', render: (r) => <Badge tone={tone[r.status] || 'gray'}>{label(r.status)}</Badge> },
    { key: 'attempts', label: 'Attempts' },
  ],
  fields: [],
  details: [
    { key: 'patient_name', label: 'Patient' }, { key: 'contact_number', label: 'Contact number' },
    { key: 'dose_number', label: 'Dose' }, { key: 'scheduled_date', label: 'Dose date', type: 'date' },
    { key: 'message', label: 'Message' }, { key: 'scheduled_for', label: 'Planned send', type: 'datetime' },
    { key: 'status', label: 'Status', type: 'enum' }, { key: 'attempts', label: 'Attempts' },
    { key: 'last_attempt_at', label: 'Last attempt', type: 'datetime' }, { key: 'gateway_response', label: 'Gateway response' },
  ],
}

export default function Vaccination() {
  return (
    <TabbedPage tabs={[
      { key: 'schedule', label: 'Schedule', element: <ResourcePage cfg={schedule} /> },
      { key: 'records', label: 'Given doses', element: <ResourcePage cfg={records} /> },
      { key: 'reminders', label: 'Reminders', element: <ResourcePage cfg={reminders} /> },
    ]} />
  )
}