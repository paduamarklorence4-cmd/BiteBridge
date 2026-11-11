import { useState } from 'react'
import ResourcePage, { errorMessage, fmtDate } from '../components/ResourcePage'
import { staffPost } from '../services/staffApi'

// Categories with plain-language meaning, so staff do not have to remember what I, II, III mean.
const CATS = [
  {
    value: 'I',
    short: 'Cat. I: walang gamot',
    long: 'Category I: paghawak o pagpapakain lang, o dinilaan ang buong balat. Walang kailangang gamot.',
  },
  {
    value: 'II',
    short: 'Cat. II: bakuna',
    long: 'Category II: kagat o kalmot na hindi malalim, o laway sa sugat. Hugasan ang sugat at bigyan ng bakuna laban sa rabies.',
  },
  {
    value: 'III',
    short: 'Cat. III: bakuna + RIG',
    long: 'Category III: malalim na kagat o kalmot, o laway sa mata, ilong, o bibig. Bakuna laban sa rabies at rabies immunoglobulin (RIG).',
  },
]

const byValue = (v) => CATS.find((c) => c.value === v)
const shortText = (v) => (byValue(v) ? byValue(v).short : '—')
const longText = (v) => (byValue(v) ? byValue(v).long : 'Waiting for confirmation')

function ConfirmCategory({ row, ctx }) {
  const [value, setValue] = useState(row.final_category || row.suggested_category || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!value) { setError('Pumili ng Category I, II, o III.'); return }
    setSaving(true)
    setError(null)
    try {
      await staffPost('/assessments/confirm', { id: row.id, final_category: value })
      ctx.done('Category confirmed.')
    } catch (err) {
      setError(errorMessage(err))
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit}>
      {error && <div className="pt-error" role="alert">{error}</div>}
      <p><strong>{row.patient_name}</strong> ({row.patient_code})<br />Incident: {fmtDate(row.incident_date)}, {row.animal_type}</p>
      <p className="pt-hint">
        Preliminary suggestion from the chatbot: {row.suggested_category ? shortText(row.suggested_category) : 'none'}.
        Only confirm after assessing the patient.
      </p>
      <div className="pt-field">
        <label htmlFor="cf-cat">Final category *</label>
        <select
          id="cf-cat"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', border: '1px solid #d9e2ec', borderRadius: 8, font: 'inherit', background: '#fff' }}
        >
          <option value="">Pumili…</option>
          {CATS.map((c) => <option key={c.value} value={c.value}>{c.long}</option>)}
        </select>
        {value && <p className="pt-hint" style={{ marginTop: 8 }}>{longText(value)}</p>}
      </div>
      <div className="pt-form-actions">
        <button type="button" className="btn btn-outline" onClick={ctx.close} disabled={saving}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Confirm category'}</button>
      </div>
    </form>
  )
}

const cfg = {
  title: 'Assessments',
  subtitle: 'Wound at exposure assessments. Ang preliminary category ay mungkahi lang ng chatbot. Ang nurse o physician ang nagkukumpirma ng final category.',
  singular: 'assessment',
  base: '/assessments',
  perms: { view: 'assessments.view', manage: 'assessments.manage' },
  searchPlaceholder: 'Search patient, code, animal, or wound',
  filters: [{ key: 'confirmed', label: 'Status', options: [{ value: 'pending', label: 'Waiting for confirmation' }, { value: 'confirmed', label: 'Confirmed' }] }],
  columns: [
    { key: 'patient_name', label: 'Patient', render: (r) => (<><strong>{r.patient_name}</strong><div className="pt-hint">{r.patient_code}</div></>) },
    { key: 'incident_date', label: 'Incident', render: (r) => `${fmtDate(r.incident_date)} (${r.animal_type || '—'})` },
    { key: 'suggested_category', label: 'Mungkahi ng chatbot', render: (r) => shortText(r.suggested_category) },
    { key: 'final_category', label: 'Final (kinumpirma)', render: (r) => (r.final_category ? <strong>{shortText(r.final_category)}</strong> : <span className="pt-hint">Hindi pa kinukumpirma</span>) },
    { key: 'confirmed_by_name', label: 'Kinumpirma ni' },
  ],
  fields: [
    { key: 'incident_id', label: 'Bite incident', type: 'ref', lookup: 'incidents', labelKey: 'incident_label', required: true },
    { key: 'wound_description', label: 'Wound description', type: 'textarea' },
    { key: 'exposure_details', label: 'Exposure details', type: 'textarea' },
    { key: 'suggested_category', label: 'Preliminary category', type: 'select', options: CATS.map((c) => ({ value: c.value, label: c.long })), hint: 'Mungkahi lang. Hindi ito diagnosis.' },
  ],
  details: [
    { key: 'patient_name', label: 'Patient' },
    { key: 'incident_label', label: 'Incident' },
    { key: 'wound_description', label: 'Wound description' },
    { key: 'exposure_details', label: 'Exposure details' },
    { key: 'suggested_category', label: 'Mungkahi ng chatbot', render: (r) => (r.suggested_category ? longText(r.suggested_category) : '—') },
    { key: 'final_category', label: 'Final category', render: (r) => longText(r.final_category) },
    { key: 'confirmed_by_name', label: 'Kinumpirma ni' },
    { key: 'confirmed_at', label: 'Kinumpirma noong', render: (r) => (r.confirmed_at ? String(r.confirmed_at).slice(0, 16).replace('T', ' ') : '—') },
  ],
  actions: [
    { label: 'Confirm', perm: 'assessments.confirm', title: 'Kumpirmahin ang category', render: (row, ctx) => <ConfirmCategory row={row} ctx={ctx} /> },
  ],
}

export default function Assessments() {
  return <ResourcePage cfg={cfg} />
}