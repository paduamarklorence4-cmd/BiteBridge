import { useEffect, useState } from 'react'
import ResourcePage, { Badge, errorMessage, fmtDateTime, label } from '../components/ResourcePage'
import { staffPost } from '../services/staffApi'

const tone = { pending: 'amber', reviewed: 'green', referred: 'navy' }
const pretty = (s) => { try { return JSON.stringify(JSON.parse(s), null, 2) } catch { return s || '—' } }

function Transcript({ row }) {
  const [state, setState] = useState({ loading: true, items: [], error: null })
  useEffect(() => {
    let alive = true
    staffPost('/chatreviews/transcript', { id: row.id })
      .then((d) => { if (alive) setState({ loading: false, items: d.items || [], error: null }) })
      .catch((e) => { if (alive) setState({ loading: false, items: [], error: e }) })
    return () => { alive = false }
  }, [row.id])
  if (state.loading) return <p>Loading…</p>
  if (state.error) return <div className="pt-error" role="alert">{errorMessage(state.error)}</div>
  if (!state.items.length) return <p className="pt-hint">No messages saved for this chat.</p>
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {state.items.map((m) => (
        <div key={m.id} style={{ padding: '8px 12px', borderRadius: 10, background: m.sender === 'user' ? '#dfe8f3' : '#f4f7fa', whiteSpace: 'pre-line' }}>
          <strong>{m.sender === 'user' ? 'Patient' : 'Chatbot'}</strong>
          <span className="pt-hint"> {fmtDateTime(m.created_at)}{m.detected_intent ? `, intent: ${m.detected_intent}` : ''}</span>
          <div>{m.message}</div>
        </div>
      ))}
    </div>
  )
}

function Photo({ row }) {
  const [state, setState] = useState({ loading: true, src: '', error: null })
  useEffect(() => {
    let alive = true
    staffPost('/chatreviews/photo', { id: row.id })
     .then((d) => {
  const src = typeof d === 'string'
    ? `data:image/jpeg;base64,${d}`
    : `data:${d.content_type};base64,${d.data}`
  if (alive) setState({ loading: false, src, error: null })
})
      .catch((e) => { if (alive) setState({ loading: false, src: '', error: e }) })
    return () => { alive = false }
  }, [row.id])
  if (state.loading) return <p>Loading…</p>
  if (state.error) return <div className="pt-error" role="alert">{errorMessage(state.error)}</div>
  return (
    <>
      <img src={state.src} alt="Wound photo sent by the patient" style={{ maxWidth: '100%', borderRadius: 8 }} />
      <p className="pt-hint">Sensitive. Only view it for the patient's care. Each view is recorded in the activity log.</p>
    </>
  )
}

function ReviewForm({ row, ctx }) {
  const [status, setStatus] = useState(row.review_status === 'pending' ? 'reviewed' : row.review_status)
  const [notes, setNotes] = useState(row.staff_notes || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  async function submit(e) {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      await staffPost('/chatreviews/review', { id: row.id, review_status: status, staff_notes: notes })
      ctx.done('Review saved.')
    } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }
  const select = { width: '100%', padding: '10px 12px', border: '1px solid #d9e2ec', borderRadius: 8, font: 'inherit', background: '#fff' }
  return (
    <form onSubmit={submit}>
      {error && <div className="pt-error" role="alert">{error}</div>}
      <p><strong>{row.contact_name || 'No name given'}</strong> {row.contact_number ? `(${row.contact_number})` : ''}<br />{row.summary}</p>
      <div className="pt-field">
        <label htmlFor="cr-status">Status</label>
        <select id="cr-status" value={status} onChange={(e) => setStatus(e.target.value)} style={select}>
          <option value="pending">Pending</option><option value="reviewed">Reviewed</option><option value="referred">Referred to staff</option>
        </select>
      </div>
      <div className="pt-field" style={{ marginTop: 12 }}>
        <label htmlFor="cr-notes">Staff notes</label>
        <textarea id="cr-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
      </div>
      <div className="pt-form-actions">
        <button type="button" className="btn btn-outline" onClick={ctx.close} disabled={saving}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save review'}</button>
      </div>
    </form>
  )
}

const cfg = {
  title: 'Chatbot Reviews',
  subtitle: 'Chats and assessments from the public chatbot. The category is a preliminary suggestion shown to staff only; staff confirm the final category when the patient arrives.',
  singular: 'chatbot assessment',
  base: '/chatreviews',
  readOnly: true,
  perms: { view: 'chatbot.review', manage: 'chatbot.review' },
  searchPlaceholder: 'Search name, contact number, summary, or reference code',
  filters: [{ key: 'review_status', label: 'Status', options: ['pending', 'reviewed', 'referred'].map((v) => ({ value: v, label: label(v) })) }],
  columns: [
    { key: 'contact_name', label: 'Contact', render: (r) => (<><strong>{r.contact_name || 'No name given'}</strong><div className="pt-hint">{r.contact_number || ''}</div></>) },
    { key: 'created_at', label: 'Chat started', type: 'datetime' },
    { key: 'language', label: 'Language', render: (r) => (r.language === 'fil' ? 'Filipino' : r.language === 'en' ? 'English' : r.language || '—') },
    { key: 'suggested_category', label: 'Suggested', render: (r) => (r.suggested_category ? `Category ${r.suggested_category}` : '—') },
    { key: 'review_status', label: 'Status', render: (r) => <Badge tone={tone[r.review_status] || 'gray'}>{label(r.review_status)}</Badge> },
    { key: 'reference_code', label: 'Reference code' },
  ],
  fields: [],
  details: [
    { key: 'contact_name', label: 'Name' }, { key: 'contact_number', label: 'Contact number' },
    { key: 'created_at', label: 'Chat started', type: 'datetime' }, { key: 'reference_code', label: 'Reference code' },
    { key: 'summary', label: 'Summary' },
    { key: 'suggested_category', label: 'Preliminary category (staff only)', render: (r) => (r.suggested_category ? `Category ${r.suggested_category}` : '—') },
    { key: 'answers', label: 'Answers', render: (r) => <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{pretty(r.answers)}</pre> },
    { key: 'review_status', label: 'Status', type: 'enum' }, { key: 'reviewed_by_name', label: 'Reviewed by' },
    { key: 'reviewed_at', label: 'Reviewed at', type: 'datetime' }, { key: 'staff_notes', label: 'Staff notes' },
  ],
  actions: [
    { label: 'Chat', perm: 'chatbot.review', title: 'Chat transcript', render: (row) => <Transcript row={row} /> },
    { label: 'Photo', perm: 'chatbot.review', title: 'Wound photo', show: (r) => Number(r.has_photo) === 1, render: (row) => <Photo row={row} /> },
    { label: 'Review', perm: 'chatbot.review', title: 'Review chatbot assessment', render: (row, ctx) => <ReviewForm row={row} ctx={ctx} /> },
  ],
}

export default function ChatReviews() {
  return <ResourcePage cfg={cfg} />
}