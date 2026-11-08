import { useEffect, useState } from 'react'
import ResourcePage, { Badge, errorMessage, fmtDate, fmtDateTime, label } from '../components/ResourcePage'
import { staffPost } from '../services/staffApi'

function StockForm({ row, ctx }) {
  const [type, setType] = useState('stock_in')
  const [qty, setQty] = useState('')
  const [remarks, setRemarks] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function submit(e) {
    e.preventDefault()
    if (!/^\d+$/.test(qty)) { setError('Enter the quantity as a whole number.'); return }
    setSaving(true); setError(null)
    try {
      await staffPost('/inventory/stock', { id: row.id, type, quantity: qty, remarks })
      ctx.done('Stock updated.')
    } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }
  const select = { width: '100%', padding: '10px 12px', border: '1px solid #d9e2ec', borderRadius: 8, font: 'inherit', background: '#fff' }
  return (
    <form onSubmit={submit}>
      {error && <div className="pt-error" role="alert">{error}</div>}
      <p><strong>{row.item_name}</strong><br />In stock now: {row.quantity} {row.unit}</p>
      <div className="pt-form">
        <div className="pt-field full">
          <label htmlFor="sk-type">Action</label>
          <select id="sk-type" value={type} onChange={(e) => setType(e.target.value)} style={select}>
            <option value="stock_in">Stock in (add)</option>
            <option value="stock_out">Stock out (use or remove)</option>
            <option value="adjustment">Adjustment (set the counted total)</option>
          </select>
        </div>
        <div className="pt-field">
          <label htmlFor="sk-qty">{type === 'adjustment' ? 'New total *' : 'Quantity *'}</label>
          <input id="sk-qty" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value)} maxLength={7} />
        </div>
        <div className="pt-field">
          <label htmlFor="sk-rem">Remarks</label>
          <input id="sk-rem" value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={255} />
        </div>
      </div>
      <div className="pt-form-actions">
        <button type="button" className="btn btn-outline" onClick={ctx.close} disabled={saving}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  )
}

function History({ row }) {
  const [state, setState] = useState({ loading: true, items: [], error: null })
  useEffect(() => {
    let alive = true
    staffPost('/inventory/history', { id: row.id })
      .then((d) => { if (alive) setState({ loading: false, items: d.items || [], error: null }) })
      .catch((e) => { if (alive) setState({ loading: false, items: [], error: e }) })
    return () => { alive = false }
  }, [row.id])
  if (state.loading) return <p>Loading…</p>
  if (state.error) return <div className="pt-error" role="alert">{errorMessage(state.error)}</div>
  if (!state.items.length) return <p className="pt-hint">No stock changes recorded.</p>
  return (
    <table className="pt-mini">
      <thead><tr><th>When</th><th>Type</th><th>Qty</th><th>By</th><th>Remarks</th></tr></thead>
      <tbody>
        {state.items.map((t) => (
          <tr key={t.id}>
            <td>{fmtDateTime(t.created_at)}</td><td>{label(t.transaction_type)}</td>
            <td>{t.transaction_type === 'stock_out' ? `−${t.quantity}` : Number(t.quantity) > 0 ? `+${t.quantity}` : t.quantity}</td>
            <td>{t.performed_by_name || '—'}</td><td>{t.remarks || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const cfg = {
  title: 'Inventory',
  subtitle: 'Supplies and vaccines with low-stock and expiration alerts. Quantities change only through Stock, so every change is in the history.',
  singular: 'item',
  base: '/inventory',
  perms: { view: 'inventory.view', manage: 'inventory.manage' },
  searchPlaceholder: 'Search item, category, or supplier',
  filters: [{ key: 'alert', label: 'Alert', options: [{ value: 'low', label: 'Low stock' }, { value: 'near', label: 'Near expiry' }, { value: 'expired', label: 'Expired' }] }],
  columns: [
    { key: 'item_name', label: 'Item', render: (r) => (<><strong>{r.item_name}</strong><div className="pt-hint">{r.category}</div></>) },
    { key: 'quantity', label: 'In stock', render: (r) => `${r.quantity} ${r.unit}` },
    { key: 'low_stock_threshold', label: 'Low-stock level' },
    { key: 'expiration_date', label: 'Expires', type: 'date' },
    { key: 'alerts', label: 'Alerts', render: (r) => {
      const out = []
      if (Number(r.is_low) === 1) out.push(<Badge key="low" tone="amber">Low stock</Badge>)
      if (r.days_to_expiry !== null && Number(r.days_to_expiry) < 0) out.push(<Badge key="exp" tone="red">Expired</Badge>)
      else if (Number(r.is_near_expiry) === 1) out.push(<Badge key="near" tone="amber">Near expiry</Badge>)
      return out.length ? <>{out}</> : <Badge tone="green">OK</Badge>
    } },
  ],
  fields: [
    { key: 'item_name', label: 'Item name', type: 'text', maxLength: 120, required: true },
    { key: 'category', label: 'Category', type: 'text', maxLength: 60, required: true, hint: 'For example: vaccine, supplies' },
    { key: 'unit', label: 'Unit', type: 'text', maxLength: 20, required: true, hint: 'For example: vial, box' },
    { key: 'quantity', label: 'Starting quantity', type: 'number', maxLength: 7, createOnly: true, hint: 'Set once. Use Stock to change it later.' },
    { key: 'low_stock_threshold', label: 'Low-stock level', type: 'number', maxLength: 7 },
    { key: 'expiration_date', label: 'Expiration date', type: 'date' },
    { key: 'supplier_name', label: 'Supplier', type: 'text', maxLength: 120 },
    { key: 'supplier_contact', label: 'Supplier contact', type: 'text', maxLength: 120 },
  ],
  details: [
    { key: 'item_name', label: 'Item' }, { key: 'category', label: 'Category' },
    { key: 'quantity', label: 'In stock', render: (r) => `${r.quantity} ${r.unit}` }, { key: 'low_stock_threshold', label: 'Low-stock level' },
    { key: 'expiration_date', label: 'Expires', type: 'date' }, { key: 'supplier_name', label: 'Supplier' }, { key: 'supplier_contact', label: 'Supplier contact' },
  ],
  actions: [
    { label: 'Stock', perm: 'inventory.manage', title: 'Update stock', render: (row, ctx) => <StockForm row={row} ctx={ctx} /> },
    { label: 'History', perm: 'inventory.view', title: 'Stock history', render: (row) => <History row={row} /> },
  ],
}

export default function Inventory() {
  return <ResourcePage cfg={cfg} />
}