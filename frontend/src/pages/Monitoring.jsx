import ResourcePage, { Badge, label } from '../components/ResourcePage'

const statuses = ['under_observation', 'completed', 'animal_died', 'lost', 'cancelled']
const tone = { under_observation: 'navy', completed: 'green', animal_died: 'red', lost: 'amber', cancelled: 'gray' }

function countdown(r) {
  if (r.status !== 'under_observation') return null
  const left = Number(r.days_left)
  const total = Number(r.observation_day) - 1 + left
  if (left < 0) return <Badge tone="amber">Observation period ended. Update the status.</Badge>
  return <span>Day {Math.max(1, Number(r.observation_day))} of {total}. {left === 0 ? 'Ends today' : `${left} day${left === 1 ? '' : 's'} left`}</span>
}

const cfg = {
  title: 'Animal Monitoring',
  subtitle: 'Observation tracker for the biting animal (14 days by default). This is an administrative tracker, not a replacement for professional assessment.',
  singular: 'monitoring record',
  base: '/monitoring',
  perms: { view: 'monitoring.view', manage: 'monitoring.manage' },
  searchPlaceholder: 'Search patient, code, or animal',
  filters: [
    { key: 'status', label: 'Status', options: statuses.map((v) => ({ value: v, label: label(v) })) },
    { key: 'view', label: 'Alerts', options: [{ value: 'alerts', label: 'Needs attention' }, { value: 'ending', label: 'Ending within 3 days' }] },
  ],
  columns: [
    { key: 'patient_name', label: 'Patient', render: (r) => (<><strong>{r.patient_name}</strong><div className="pt-hint">{r.patient_code}</div></>) },
    { key: 'animal_type', label: 'Animal', render: (r) => (<>{label(r.animal_type)}<div className="pt-hint">{r.animal_description || ''}</div></>) },
    { key: 'observation_start_date', label: 'Started', type: 'date' },
    { key: 'expected_end_date', label: 'Expected end', type: 'date' },
    { key: 'status', label: 'Status', render: (r) => (
      <>
        <Badge tone={tone[r.status] || 'gray'}>{label(r.status)}</Badge>
        <div className="pt-hint">{countdown(r)}</div>
        {Number(r.animal_death_reported) === 1 && <Badge tone="red">Animal death reported</Badge>}
      </>
    ) },
  ],
  fields: [
    { key: 'incident_id', label: 'Bite incident', type: 'ref', lookup: 'incidents', labelKey: 'incident_label', required: true },
    { key: 'animal_description', label: 'Animal description', type: 'text', maxLength: 255, hint: 'For example: brown dog, owned, with collar' },
    { key: 'observation_start_date', label: 'Observation start date', type: 'date', noFuture: true, required: true, hint: 'The end date is calculated automatically.' },
    { key: 'status', label: 'Status', type: 'select', options: statuses.map((v) => ({ value: v, label: label(v) })) },
    { key: 'animal_death_reported', label: 'Animal death reported', type: 'select', options: [{ value: '0', label: 'No' }, { value: '1', label: 'Yes' }] },
    { key: 'death_reported_date', label: 'Date death was reported', type: 'date', noFuture: true },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
  details: [
    { key: 'patient_name', label: 'Patient' }, { key: 'incident_label', label: 'Incident' },
    { key: 'animal_description', label: 'Animal description' },
    { key: 'observation_start_date', label: 'Started', type: 'date' }, { key: 'expected_end_date', label: 'Expected end', type: 'date' },
    { key: 'status', label: 'Status', type: 'enum' }, { key: 'animal_death_reported', label: 'Animal death reported', type: 'bool' },
    { key: 'death_reported_date', label: 'Death reported on', type: 'date' }, { key: 'notes', label: 'Notes' },
  ],
}

export default function Monitoring() {
  return <ResourcePage cfg={cfg} />
}