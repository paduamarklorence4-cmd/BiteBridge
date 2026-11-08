import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as Lucide from 'lucide-react'
import { getSession } from '../services/api'
import { staffPost } from '../services/staffApi'
import '../pages/Patients.css'
import './Staff.css'

const pick = (...names) => names.map((n) => Lucide[n]).find(Boolean) || Lucide.Circle
const SearchIcon = pick('Search')
const Plus = pick('Plus')
const EyeIcon = pick('Eye')
const Pencil = pick('Pencil', 'SquarePen')
const X = pick('X')
const ChevronLeft = pick('ChevronLeft')
const ChevronRight = pick('ChevronRight')

const PER_PAGE = 10

export const todayStr = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
export const fmtDate = (s) => {
  if (!s) return '—'
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number)
  if (!y) return '—'
  return new Date(y, m - 1, d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}
export const label = (s) => (s ? String(s).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : '—')

export const money = (v) => (v === null || v === undefined || v === '' ? '—' : new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(v)))
export const fmtDateTime = (s) => {
  if (!s) return '—'
  const t = String(s).replace('T', ' ')
  return `${fmtDate(t.slice(0, 10))} ${t.slice(11, 16)}`.trim()
}

export function Badge({ tone = 'gray', children }) {
  return <span className={`st-badge st-badge-${tone}`}>{children}</span>
}

export function errorMessage(e) {
  if (e?.status === 401) return <>Your session has expired. <Link to="/staff-login">Sign in again</Link>.</>
  if (e?.status === 403) return 'Your role is not allowed to do this.'
  return e?.message || 'Something went wrong.'
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="pt-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pt-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="pt-modal-head">
          <h2>{title}</h2>
          <button type="button" className="st-iconbtn" onClick={onClose} aria-label="Close"><X size={20} strokeWidth={1.75} aria-hidden="true" /></button>
        </div>
        <div className="pt-modal-body">{children}</div>
      </div>
    </div>
  )
}

// Search-as-you-type picker for linked records (patient, incident).
function RefSelect({ id, resource, value, initialLabel, onChange, optional }) {
  const [text, setText] = useState(initialLabel || '')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(!value)
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  useEffect(() => {
    if (!open) return undefined
    let alive = true
    const t = setTimeout(() => {
      setBusy(true)
      staffPost('/lookup/search', { resource, term: q })
        .then((d) => { if (alive) { setItems(d.items || []); setErr(null) } })
        .catch((e) => { if (alive) setErr(e) })
        .finally(() => { if (alive) setBusy(false) })
    }, 250)
    return () => { alive = false; clearTimeout(t) }
  }, [open, q, resource])

  if (value && !open) {
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1, padding: '10px 12px', border: '1px solid #d9e2ec', borderRadius: 8, background: '#f8fafc' }}>{text || `#${value}`}</div>
        <button type="button" className="pt-iconbtn" onClick={() => { setOpen(true); setQ('') }}>Change</button>
        {optional && <button type="button" className="pt-iconbtn" onClick={() => { onChange(''); setText(''); setOpen(true); setQ('') }}>Clear</button>}
      </div>
    )
  }
  return (
    <div>
      <input id={id} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type to search…" autoComplete="off" />
      <div role="listbox" aria-label="Search results" style={{ border: '1px solid #d9e2ec', borderRadius: 8, marginTop: 6, maxHeight: 180, overflowY: 'auto', background: '#fff' }}>
        {busy && <div className="pt-hint" style={{ padding: 10 }}>Searching…</div>}
        {err && <div className="pt-hint" style={{ padding: 10 }}>{errorMessage(err)}</div>}
        {!busy && !err && items.length === 0 && <div className="pt-hint" style={{ padding: 10 }}>No matches.</div>}
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            role="option"
            aria-selected={false}
            className="pt-iconbtn"
            style={{ display: 'block', width: '100%', textAlign: 'left', border: 0, borderBottom: '1px solid #e4ebf2', borderRadius: 0 }}
            onClick={() => { setText(it.label); setOpen(false); onChange(String(it.id)) }}
          >
            {it.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function RecordForm({ cfg, row, onCancel, onSaved }) {
  const editing = Boolean(row)
  const [f, setF] = useState(() => {
    const o = {}
    cfg.fields.forEach((fd) => { o[fd.key] = row?.[fd.key] ?? '' })
    return o
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    const missing = cfg.fields.filter((fd) => fd.required && !(editing && fd.optionalOnEdit) && String(f[fd.key] ?? '').trim() === '')
    if (missing.length) { setError(`${missing.map((m) => m.label).join(', ')} ${missing.length > 1 ? 'are' : 'is'} required.`); return }
    setSaving(true)
    setError(null)
    try {
      const body = { ...f }
      const res = editing
        ? await staffPost(`${cfg.base}/update`, { ...body, id: row.id })
        : await staffPost(`${cfg.base}/create`, body)
      onSaved(res.item, editing)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      {error && <div className="pt-error" role="alert">{error}</div>}
      <div className="pt-form">
        {cfg.fields.map((fd) => {
          const id = `rf-${fd.key}`
          const full = fd.full || fd.type === 'textarea' || fd.type === 'ref'
          return (
            <div key={fd.key} className={`pt-field${full ? ' full' : ''}`}>
              <label htmlFor={id}>{fd.label}{fd.required ? ' *' : ''}</label>
              {fd.type === 'textarea' && <textarea id={id} value={f[fd.key]} onChange={set(fd.key)} />}
              {fd.type === 'select' && (
                <select id={id} value={f[fd.key]} onChange={set(fd.key)} disabled={editing && fd.createOnly} style={{ width: '100%', padding: '10px 12px', border: '1px solid #d9e2ec', borderRadius: 8, font: 'inherit', background: '#fff' }}>
                  <option value="">{fd.required ? 'Choose…' : 'None'}</option>
                  {fd.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )}
              {fd.type === 'ref' && (
                <RefSelect id={id} resource={fd.lookup} value={f[fd.key]} initialLabel={row?.[fd.labelKey]} optional={!fd.required} onChange={(v) => setF((s) => ({ ...s, [fd.key]: v }))} />
              )}
              {(fd.type === 'text' || fd.type === 'date' || fd.type === 'number' || fd.type === 'time' || fd.type === 'password') && (
                <input
                  id={id}
                  type={fd.type === 'date' ? 'date' : fd.type === 'time' ? 'time' : fd.type === 'password' ? 'password' : 'text'}
                  autoComplete={fd.type === 'password' ? 'new-password' : undefined}
                  inputMode={fd.type === 'number' ? 'numeric' : undefined}
                  max={fd.type === 'date' && fd.noFuture ? todayStr() : undefined}
                  maxLength={fd.maxLength}
                  disabled={editing && fd.createOnly}
                  value={f[fd.key]}
                  onChange={set(fd.key)}
                />
              )}
              {fd.hint && <div className="pt-hint">{fd.hint}</div>}
            </div>
          )
        })}
      </div>
      <div className="pt-form-actions">
        <button type="button" className="btn btn-outline" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : `Add ${cfg.singular}`}</button>
      </div>
    </form>
  )
}

function cell(col, row) {
  if (col.render) return col.render(row)
  const v = row[col.key]
  if (v === null || v === undefined || v === '') return '—'
  if (col.type === 'date') return fmtDate(v)
  if (col.type === 'datetime') return fmtDateTime(v)
  if (col.type === 'money') return money(v)
  if (col.type === 'bool') return Number(v) === 1 ? 'Yes' : 'No'
  if (col.type === 'enum') return label(v)
  return v
}

function RecordView({ cfg, id }) {
  const [state, setState] = useState({ loading: true, item: null, error: null })
  useEffect(() => {
    let alive = true
    staffPost(`${cfg.base}/detail`, { id })
      .then((d) => { if (alive) setState({ loading: false, item: d.item, error: null }) })
      .catch((e) => { if (alive) setState({ loading: false, item: null, error: e }) })
    return () => { alive = false }
  }, [cfg.base, id])
  if (state.loading) return <p>Loading…</p>
  if (state.error) return <div className="pt-error" role="alert">{errorMessage(state.error)}</div>
  return (
    <dl className="pt-kv">
      {cfg.details.map((d) => (
        <div key={d.key} style={{ display: 'contents' }}>
          <dt>{d.label}</dt>
          <dd style={{ whiteSpace: 'pre-line' }}>{cell(d, state.item)}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * Generic staff list page. cfg: { title, subtitle, singular, base, perms:{view,manage}, searchPlaceholder,
 *   columns, fields, details, filters?, actions? }
 * actions: [{ label, perm, title, render(row, ctx) }] shown as extra buttons per row.
 */
export default function ResourcePage({ cfg }) {
  const perms = getSession()?.user?.permissions || []
  const canManage = !cfg.readOnly && perms.includes(cfg.perms.manage)

  const [input, setInput] = useState('')
  const [term, setTerm] = useState('')
  const [filters, setFilters] = useState({})
  const [page, setPage] = useState(1)
  const [reload, setReload] = useState(0)
  const [state, setState] = useState({ loading: true, data: null, error: null })
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState('')
  const first = useRef(true)

  useEffect(() => {
    if (first.current) { first.current = false; return undefined }
    const t = setTimeout(() => { setTerm(input.trim()); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [input])

  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true, error: null }))
    staffPost(`${cfg.base}/search`, { search: term, page, per_page: PER_PAGE, filters })
      .then((d) => { if (alive) setState({ loading: false, data: d, error: null }) })
      .catch((e) => { if (alive) setState({ loading: false, data: null, error: e }) })
    return () => { alive = false }
  }, [cfg.base, term, page, reload, filters])

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(''), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const close = useCallback(() => setModal(null), [])
  const { loading, data, error } = state
  const items = data?.items || []
  const actions = (cfg.actions || []).filter((a) => perms.includes(a.perm))

  function saved(item, wasEdit) {
    setModal(null)
    setToast(wasEdit ? `${label(cfg.singular)} updated.` : `${label(cfg.singular)} saved.`)
    setReload((n) => n + 1)
  }

  return (
    <>
      <h1>{cfg.title}</h1>
      <p className="st-sub">{cfg.subtitle}</p>

      <div className="pt-toolbar">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', flex: '1 1 320px', alignItems: 'center' }}>
          <div className="pt-search">
            <SearchIcon size={18} strokeWidth={1.75} aria-hidden="true" />
            <label htmlFor="rp-q" className="sr-only">Search</label>
            <input id="rp-q" value={input} onChange={(e) => setInput(e.target.value)} placeholder={cfg.searchPlaceholder || 'Search'} maxLength={100} />
            {input && <button type="button" onClick={() => setInput('')} aria-label="Clear search"><X size={16} strokeWidth={1.75} aria-hidden="true" /></button>}
          </div>
          {(cfg.filters || []).map((fl) => (
            <label key={fl.key} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span className="sr-only">{fl.label}</span>
              <select
                value={filters[fl.key] || ''}
                onChange={(e) => { setFilters((s) => ({ ...s, [fl.key]: e.target.value })); setPage(1) }}
                style={{ padding: '9px 10px', border: '1px solid #d9e2ec', borderRadius: 10, font: 'inherit', background: '#fff' }}
              >
                <option value="">{fl.label}: all</option>
                {fl.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>
          ))}
        </div>
        {canManage && (
          <button type="button" className="btn btn-primary" onClick={() => setModal({ mode: 'add' })}>
            <Plus size={18} strokeWidth={1.75} aria-hidden="true" /> Add {cfg.singular}
          </button>
        )}
      </div>

      {error && (
        <div className="st-card st-notice" role="alert" style={{ marginBottom: 16 }}>
          {errorMessage(error)}{' '}
          {error.status !== 401 && <button type="button" className="pt-iconbtn" onClick={() => setReload((n) => n + 1)}>Try again</button>}
        </div>
      )}

      <div className="st-card" style={{ padding: 0 }}>
        <div className="pt-tablewrap">
          <table className="pt-table">
            <thead>
              <tr>
                {cfg.columns.map((c) => <th key={c.key}>{c.label}</th>)}
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <tr className="pt-skelrow" key={i}>{Array.from({ length: cfg.columns.length + 1 }).map((__, j) => <td key={j}><div /></td>)}</tr>
              ))}
              {!loading && items.map((row) => (
                <tr key={row.id}>
                  {cfg.columns.map((c) => <td key={c.key}>{cell(c, row)}</td>)}
                  <td>
                    <div className="pt-actions">
                      {!cfg.noView && (
                        <button type="button" className="pt-iconbtn" onClick={() => setModal({ mode: 'view', row })} aria-label={`View ${cfg.singular}`}>
                          <EyeIcon size={16} strokeWidth={1.75} aria-hidden="true" /> View
                        </button>
                      )}
                      {canManage && (
                        <button type="button" className="pt-iconbtn" onClick={() => setModal({ mode: 'edit', row })} aria-label={`Edit ${cfg.singular}`}>
                          <Pencil size={16} strokeWidth={1.75} aria-hidden="true" /> Edit
                        </button>
                      )}
                      {actions.filter((a) => !a.show || a.show(row)).map((a) => (
                        <button key={a.label} type="button" className="pt-iconbtn" onClick={() => setModal({ mode: 'action', row, action: a })}>{a.label}</button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && !error && items.length === 0 && (
            <div className="pt-empty">{term || Object.values(filters).some(Boolean) ? 'Nothing matches your search or filter.' : `No ${cfg.title.toLowerCase()} yet.`}</div>
          )}
        </div>

        {data && data.total > 0 && (
          <div className="pt-pager">
            <span>Showing {(data.page - 1) * data.per_page + 1}–{(data.page - 1) * data.per_page + items.length} of {data.total}</span>
            <div className="pt-pager-btns">
              <button type="button" className="pt-iconbtn" disabled={data.page <= 1 || loading} onClick={() => setPage(data.page - 1)}>
                <ChevronLeft size={16} strokeWidth={1.75} aria-hidden="true" /> Previous
              </button>
              <span style={{ alignSelf: 'center' }}>Page {data.page} of {data.total_pages}</span>
              <button type="button" className="pt-iconbtn" disabled={data.page >= data.total_pages || loading} onClick={() => setPage(data.page + 1)}>
                Next <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>

      {modal?.mode === 'add' && <Modal title={`Add ${cfg.singular}`} onClose={close}><RecordForm cfg={cfg} onCancel={close} onSaved={saved} /></Modal>}
      {modal?.mode === 'edit' && <Modal title={`Edit ${cfg.singular}`} onClose={close}><RecordForm cfg={cfg} row={modal.row} onCancel={close} onSaved={saved} /></Modal>}
      {modal?.mode === 'view' && <Modal title={`${label(cfg.singular)} details`} onClose={close}><RecordView cfg={cfg} id={modal.row.id} /></Modal>}
      {modal?.mode === 'action' && (
        <Modal title={modal.action.title || modal.action.label} onClose={close}>
          {modal.action.render(modal.row, {
            close,
            done: (msg) => { setModal(null); setToast(msg); setReload((n) => n + 1) },
          })}
        </Modal>
      )}

      {toast && <div className="pt-toast" role="status">{toast}</div>}
    </>
  )
}