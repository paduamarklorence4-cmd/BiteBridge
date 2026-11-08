import { useState } from 'react'
import ResourcePage, { errorMessage, fmtDate } from '../components/ResourcePage'
import { staffPost } from '../services/staffApi'

const cats = [
  { value: 'I', label: 'Category I' },
  { value: 'II', label: 'Category II' },
  { value: 'III', label: 'Category III' },
]

function ConfirmCategory({ row, ctx }) {
  const [value, setValue] = useState(row.final_category || row.suggested_category || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!value) { setError('Choose Category I, II, or III.'); return }
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
      <p className="pt-hint">Preliminary category: {row.suggested_category ? `Category ${row.suggested_category}` : 'none'}. Only confirm after assessing the patient.</p>
      <div className="pt-field">
        <label htmlFor="cf-cat">Final category *</label>
        <select id="cf-cat" value={value} onChange={(e) => setValue(e.target.value)} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d9e2ec', borderRadius: 8, font: 'inherit', background: '#fff' }}>
          <option value="">Choose…</option>
          {cats.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      <div className="pt-form-actions">
        <button type="button" className="btn btn-outline" onClick={ctx.close} disabled={saving}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Confirm category'}</button>
      </div>
    </form>
  )
}

const catText = (c) => (c ? `Category ${c}` : '—')

const cfg = {
  title: 'Assessments',
  subtitle: 'Wound and exposure assessments. The preliminary category is a suggestion; a nurse or physician confirms the final category.',
  singular: 'assessment',
  base: '/assessments',
  perms: { view: 'assessments.view', manage: 'assessments.manage' },
  searchPlaceholder: 'Search patient, code, animal, or wound',
  filters: [{ key: 'confirmed', label: 'Status', options: [{ value: 'pending', label: 'Waiting for confirmation' }, { value: 'confirmed', label: 'Confirmed' }] }],
  columns: [
    { key: 'patient_name', label: 'Patient', render: (r) => (<><strong>{r.patient_name}</strong><div className="pt-hint">{r.patient_code}</div></>) },
    { key: 'incident_date', label: 'Incident', render: (r) => `${fmtDate(r.incident_date)} (${r.animal_type || '—'})` },
    { key: 'suggested_category', label: 'Preliminary', render: (r) => catText(r.suggested_category) },
    { key: 'final_category', label: 'Final', render: (r) => (r.final_category ? <strong>{catText(r.final_category)}</strong> : <span className="pt-hint">Pending</span>) },
    { key: 'confirmed_by_name', label: 'Confirmed by' },
  ],
  fields: [
    { key: 'incident_id', label: 'Bite incident', type: 'ref', lookup: 'incidents', labelKey: 'incident_label', required: true },
    { key: 'wound_description', label: 'Wound description', type: 'textarea' },
    { key: 'exposure_details', label: 'Exposure details', type: 'textarea' },
    { key: 'suggested_category', label: 'Preliminary category', type: 'select', options: cats, hint: 'A suggestion only. It is not a diagnosis.' },
  ],
  details: [
    { key: 'patient_name', label: 'Patient' },
    { key: 'incident_label', label: 'Incident' },
    { key: 'wound_description', label: 'Wound description' },
    { key: 'exposure_details', label: 'Exposure details' },
    { key: 'suggested_category', label: 'Preliminary category', render: (r) => catText(r.suggested_category) },
    { key: 'final_category', label: 'Final category', render: (r) => (r.final_category ? catText(r.final_category) : 'Waiting for confirmation') },
    { key: 'confirmed_by_name', label: 'Confirmed by' },
    { key: 'confirmed_at', label: 'Confirmed at', render: (r) => (r.confirmed_at ? String(r.confirmed_at).slice(0, 16).replace('T', ' ') : '—') },
  ],
  actions: [
    { label: 'Confirm', perm: 'assessments.confirm', title: 'Confirm exposure category', render: (row, ctx) => <ConfirmCategory row={row} ctx={ctx} /> },
  ],
}

export default function Assessments() {
  return <ResourcePage cfg={cfg} />
}