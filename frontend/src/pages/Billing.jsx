import { useState } from 'react'
import ResourcePage, { Badge, errorMessage, fmtDate, label, money, todayStr } from '../components/ResourcePage'
import { staffPost } from '../services/staffApi'

const tone = { unpaid: 'amber', paid: 'green', cancelled: 'gray' }
const methodLabel = { cash: 'Cash', gcash: 'GCash', maya: 'Maya' }

function PayForm({ row, ctx }) {
  const [method, setMethod] = useState('cash')
  const [date, setDate] = useState(todayStr())
  const [ref, setRef] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      await staffPost('/billing/pay', { id: row.id, payment_method: method, payment_date: date, reference_number: ref })
      ctx.done('Payment recorded.')
    } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }
  const select = { width: '100%', padding: '10px 12px', border: '1px solid #d9e2ec', borderRadius: 8, font: 'inherit', background: '#fff' }
  return (
    <form onSubmit={submit}>
      {error && <div className="pt-error" role="alert">{error}</div>}
      <p><strong>{row.patient_name}</strong><br />{row.service_description}<br />Amount due: <strong>{money(row.total_amount)}</strong></p>
      <div className="pt-form">
        <div className="pt-field">
          <label htmlFor="py-method">Payment method *</label>
          <select id="py-method" value={method} onChange={(e) => setMethod(e.target.value)} style={select}>
            <option value="cash">Cash</option><option value="gcash">GCash</option><option value="maya">Maya</option>
          </select>
        </div>
        <div className="pt-field"><label htmlFor="py-date">Payment date</label><input id="py-date" type="date" max={todayStr()} value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="pt-field full"><label htmlFor="py-ref">Reference number</label><input id="py-ref" value={ref} onChange={(e) => setRef(e.target.value)} maxLength={60} /><div className="pt-hint">Optional. For GCash or Maya, the reference shown on the receipt.</div></div>
      </div>
      <p className="pt-hint">The payment is recorded as received at the center. There is no online payment.</p>
      <div className="pt-form-actions">
        <button type="button" className="btn btn-outline" onClick={ctx.close} disabled={saving}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Record payment'}</button>
      </div>
    </form>
  )
}

function CancelBill({ row, ctx }) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  async function submit(e) {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      await staffPost('/billing/cancel', { id: row.id })
      ctx.done('Bill cancelled.')
    } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }
  return (
    <form onSubmit={submit}>
      {error && <div className="pt-error" role="alert">{error}</div>}
      <p>Cancel the bill for <strong>{row.patient_name}</strong> ({row.service_description}, {money(row.total_amount)})? A cancelled bill cannot be paid.</p>
      <div className="pt-form-actions">
        <button type="button" className="btn btn-outline" onClick={ctx.close} disabled={saving}>Keep bill</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Cancel bill'}</button>
      </div>
    </form>
  )
}

const cfg = {
  title: 'Billing',
  subtitle: 'Service fees and payments. All payments are recorded as paid at the center (cash, GCash, or Maya). There is no online payment.',
  singular: 'bill',
  base: '/billing',
  perms: { view: 'billing.view', manage: 'billing.manage' },
  searchPlaceholder: 'Search patient, code, service, or reference',
  filters: [
    { key: 'payment_status', label: 'Status', options: ['unpaid', 'paid', 'cancelled'].map((v) => ({ value: v, label: label(v) })) },
    { key: 'payment_method', label: 'Method', options: Object.entries(methodLabel).map(([value, l]) => ({ value, label: l })) },
  ],
  columns: [
    { key: 'patient_name', label: 'Patient', render: (r) => (<><strong>{r.patient_name}</strong><div className="pt-hint">{r.patient_code}</div></>) },
    { key: 'service_description', label: 'Service' },
    { key: 'total_amount', label: 'Total', type: 'money' },
    { key: 'payment_status', label: 'Status', render: (r) => <Badge tone={tone[r.payment_status] || 'gray'}>{label(r.payment_status)}</Badge> },
    { key: 'payment_method', label: 'Paid by', render: (r) => (r.payment_method ? `${methodLabel[r.payment_method]} on ${fmtDate(r.payment_date)}` : '—') },
  ],
  fields: [
    { key: 'patient_id', label: 'Patient', type: 'ref', lookup: 'patients', labelKey: 'patient_label', required: true },
    { key: 'incident_id', label: 'Bite incident', type: 'ref', lookup: 'incidents', labelKey: 'incident_label' },
    { key: 'service_description', label: 'Service', type: 'text', maxLength: 200, required: true, hint: 'For example: consultation and vaccine dose' },
    { key: 'service_fee', label: 'Service fee', type: 'text', maxLength: 11, required: true, hint: 'Amount in pesos, for example 500.00' },
    { key: 'total_amount', label: 'Total amount', type: 'text', maxLength: 11, hint: 'Leave blank to use the service fee.' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
  details: [
    { key: 'patient_name', label: 'Patient' }, { key: 'incident_label', label: 'Incident' },
    { key: 'service_description', label: 'Service' }, { key: 'service_fee', label: 'Service fee', type: 'money' },
    { key: 'total_amount', label: 'Total amount', type: 'money' }, { key: 'payment_status', label: 'Status', type: 'enum' },
    { key: 'payment_method', label: 'Payment method', render: (r) => methodLabel[r.payment_method] || '—' },
    { key: 'payment_date', label: 'Paid on', type: 'date' }, { key: 'reference_number', label: 'Reference number' }, { key: 'notes', label: 'Notes' },
  ],
  actions: [
    { label: 'Record payment', perm: 'billing.manage', title: 'Record payment', show: (r) => r.payment_status === 'unpaid', render: (row, ctx) => <PayForm row={row} ctx={ctx} /> },
    { label: 'Cancel', perm: 'billing.manage', title: 'Cancel bill', show: (r) => r.payment_status === 'unpaid', render: (row, ctx) => <CancelBill row={row} ctx={ctx} /> },
  ],
}

export default function Billing() {
  return <ResourcePage cfg={cfg} />
}