import ResourcePage from '../components/ResourcePage'

const injuries = [
  { value: 'bite', label: 'Bite' },
  { value: 'scratch', label: 'Scratch' },
  { value: 'bite_and_scratch', label: 'Bite and scratch' },
  { value: 'lick_on_broken_skin', label: 'Lick on broken skin' },
  { value: 'other', label: 'Other' },
]

const cfg = {
  title: 'Bite Incidents',
  subtitle: 'Record and review animal bite and scratch incidents.',
  singular: 'incident',
  base: '/incidents',
  perms: { view: 'incidents.view', manage: 'incidents.manage' },
  searchPlaceholder: 'Search patient, code, animal, or location',
  filters: [{ key: 'injury_type', label: 'Injury', options: injuries }],
  columns: [
    { key: 'patient_name', label: 'Patient', render: (r) => (<><strong>{r.patient_name}</strong><div className="pt-hint">{r.patient_code}</div></>) },
    { key: 'incident_date', label: 'Date', type: 'date' },
    { key: 'animal_type', label: 'Animal', type: 'enum' },
    { key: 'injury_type', label: 'Injury', type: 'enum' },
    { key: 'body_part', label: 'Body part' },
    { key: 'incident_location', label: 'Location' },
  ],
  fields: [
    { key: 'patient_id', label: 'Patient', type: 'ref', lookup: 'patients', labelKey: 'patient_label', required: true },
    { key: 'incident_date', label: 'Incident date', type: 'date', noFuture: true, required: true },
    { key: 'animal_type', label: 'Animal type', type: 'text', maxLength: 40, required: true, hint: 'For example: dog, cat' },
    { key: 'injury_type', label: 'Injury type', type: 'select', options: injuries, required: true },
    { key: 'body_part', label: 'Body part', type: 'text', maxLength: 80 },
    { key: 'incident_location', label: 'Incident location', type: 'text', maxLength: 255 },
    { key: 'wound_details', label: 'Wound details', type: 'textarea' },
    { key: 'staff_notes', label: 'Staff notes', type: 'textarea' },
  ],
  details: [
    { key: 'patient_name', label: 'Patient' },
    { key: 'patient_code', label: 'Patient code' },
    { key: 'incident_date', label: 'Incident date', type: 'date' },
    { key: 'animal_type', label: 'Animal', type: 'enum' },
    { key: 'injury_type', label: 'Injury type', type: 'enum' },
    { key: 'body_part', label: 'Body part' },
    { key: 'incident_location', label: 'Location' },
    { key: 'wound_details', label: 'Wound details' },
    { key: 'staff_notes', label: 'Staff notes' },
  ],
}

export default function Incidents() {
  return <ResourcePage cfg={cfg} />
}