import ResourcePage from '../components/ResourcePage'

// Must match DETAIL_OPTIONS in TreatmentsController.php (same labels).
const DETAIL_OPTIONS = {
  washed: 'Washed the wound with soap and water',
  dressed: 'Applied a dressing',
  vaccine: 'Given rabies vaccine',
  rig: 'Given rabies immunoglobulin (RIG)',
  tetanus: 'Given tetanus shot',
  referred: 'Referred to physician',
  other: 'Other (see Notes)',
}

const cfg = {
  title: 'Treatment',
  subtitle: 'Record the treatment given for each bite incident.',
  singular: 'treatment record',
  base: '/treatments',
  perms: { view: 'treatments.view', manage: 'treatments.manage' },
  searchPlaceholder: 'Search patient, code, animal, or treatment',
  columns: [
    { key: 'patient_name', label: 'Patient', render: (r) => (<><strong>{r.patient_name}</strong><div className="pt-hint">{r.patient_code}</div></>) },
    { key: 'treatment_date', label: 'Treatment date', type: 'date' },
    { key: 'incident_date', label: 'Incident', render: (r) => `${r.incident_date ? new Date(r.incident_date + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'} (${r.animal_type || '—'})` },
    { key: 'treatment_details', label: 'Treatment done', render: (r) => (r.treatment_details?.length > 80 ? `${r.treatment_details.slice(0, 80)}…` : r.treatment_details) },
    { key: 'treated_by_name', label: 'Treated by' },
  ],
  fields: [
    { key: 'incident_id', label: 'Bite incident', type: 'ref', lookup: 'incidents', labelKey: 'incident_label', required: true },
    { key: 'treatment_date', label: 'Treatment date', type: 'date', noFuture: true, required: true },
    { key: 'treatment_details', label: 'Treatment done (select all that apply)', type: 'checkboxes', options: DETAIL_OPTIONS, required: true },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
  details: [
    { key: 'patient_name', label: 'Patient' },
    { key: 'patient_code', label: 'Patient code' },
    { key: 'incident_label', label: 'Incident' },
    { key: 'treatment_date', label: 'Treatment date', type: 'date' },
    { key: 'treatment_details', label: 'Treatment done' },
    { key: 'notes', label: 'Notes' },
    { key: 'treated_by_name', label: 'Treated by' },
  ],
}

export default function Treatments() {
  return <ResourcePage cfg={cfg} />
}