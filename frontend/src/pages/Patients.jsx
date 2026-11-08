import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as Lucide from 'lucide-react'
import { getSession } from '../services/api'
import { staffPost } from '../services/staffApi'
import './Patients.css'

const pick = (...names) => names.map((n) => Lucide[n]).find(Boolean) || Lucide.Circle
const SearchIcon = pick('Search')
const Plus = pick('Plus')
const EyeIcon = pick('Eye')
const Pencil = pick('Pencil', 'SquarePen')
const X = pick('X')
const ChevronLeft = pick('ChevronLeft')
const ChevronRight = pick('ChevronRight')

const PER_PAGE = 10
const todayStr = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const fmtDate = (s) => {
  if (!s) return '—'
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number)
  if (!y) return '—'
  return new Date(y, m - 1, d).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}
const fullName = (p) => [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(' ')
const label = (s) => (s ? String(s).replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()) : '—')

function errorMessage(e) {
  if (e?.status === 401) return <>Your session has expired. <Link to="/staff-login">Sign in again</Link>.</>
  if (e?.status === 403) return 'Your role is not allowed to do this.'
  return e?.message || 'Something went wrong.'
}

function Modal({ title, onClose, children }) {
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

function PatientForm({ patient, onCancel, onSaved }) {
  const editing = Boolean(patient)
  const [f, setF] = useState({
    first_name: patient?.first_name || '',
    middle_name: patient?.middle_name || '',
    last_name: patient?.last_name || '',
    birth_date: patient?.birth_date || '',
    age_years: patient?.age_years ?? '',
    contact_number: patient?.contact_number || '',
    address: patient?.address || '',
    registration_date: patient?.registration_date || todayStr(),
    notes: patient?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const first = useRef(null)
  useEffect(() => { first.current?.focus() }, [])

  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }))

  function check() {
    const errs = []
    if (!f.first_name.trim()) errs.push('First name is required.')
    if (!f.last_name.trim()) errs.push('Last name is required.')
    if (!f.birth_date && f.age_years === '') errs.push('Enter the date of birth or the age.')
    if (f.age_years !== '' && !/^\d{1,3}$/.test(String(f.age_years))) errs.push('Age must be a whole number.')
    if (f.contact_number && !/^\+?\d{7,15}$/.test(f.contact_number.replace(/[\s\-()]/g, ''))) {
      errs.push('Contact number must be 7 to 15 digits.')
    }
    return errs
  }

  async function submit(e) {
    e.preventDefault()
    const errs = check()
    if (errs.length) { setError(errs.join(' ')); return }
    setSaving(true)
    setError(null)
    try {
      const body = { ...f, age_years: f.age_years === '' ? '' : String(f.age_years) }
      const res = editing
        ? await staffPost('/patients/update', { ...body, id: patient.id })
        : await staffPost('/patients/create', body)
      onSaved(res.patient, editing)
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
        <div className="pt-field">
          <label htmlFor="pt-first">First name *</label>
          <input id="pt-first" ref={first} value={f.first_name} onChange={set('first_name')} maxLength={60} required />
        </div>
        <div className="pt-field">
          <label htmlFor="pt-middle">Middle name</label>
          <input id="pt-middle" value={f.middle_name} onChange={set('middle_name')} maxLength={60} />
        </div>
        <div className="pt-field full">
          <label htmlFor="pt-last">Last name *</label>
          <input id="pt-last" value={f.last_name} onChange={set('last_name')} maxLength={60} required />
        </div>
        <div className="pt-field">
          <label htmlFor="pt-birth">Date of birth</label>
          <input id="pt-birth" type="date" max={todayStr()} value={f.birth_date} onChange={set('birth_date')} />
        </div>
        <div className="pt-field">
          <label htmlFor="pt-age">Age (years)</label>
          <input id="pt-age" inputMode="numeric" value={f.age_years} onChange={set('age_years')} maxLength={3} />
          <div className="pt-hint">Enter either one. If you enter a date of birth, the age is calculated.</div>
        </div>
        <div className="pt-field">
          <label htmlFor="pt-contact">Contact number</label>
          <input id="pt-contact" inputMode="tel" value={f.contact_number} onChange={set('contact_number')} maxLength={20} />
        </div>
        <div className="pt-field">
          <label htmlFor="pt-reg">Registration date</label>
          <input id="pt-reg" type="date" max={todayStr()} value={f.registration_date} onChange={set('registration_date')} />
        </div>
        <div className="pt-field full">
          <label htmlFor="pt-address">Address</label>
          <input id="pt-address" value={f.address} onChange={set('address')} maxLength={255} />
        </div>
        <div className="pt-field full">
          <label htmlFor="pt-notes">Notes</label>
          <textarea id="pt-notes" value={f.notes} onChange={set('notes')} maxLength={2000} />
        </div>
      </div>
      <div className="pt-form-actions">
        <button type="button" className="btn btn-outline" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : editing ? 'Save changes' : 'Register patient'}</button>
      </div>
    </form>
  )
}

function PatientView({ id }) {
  const [state, setState] = useState({ loading: true, patient: null, error: null })
  useEffect(() => {
    let alive = true
    staffPost('/patients/detail', { id })
      .then((d) => { if (alive) setState({ loading: false, patient: d.patient, error: null }) })
      .catch((e) => { if (alive) setState({ loading: false, patient: null, error: e }) })
    return () => { alive = false }
  }, [id])

  if (state.loading) return <p>Loading…</p>
  if (state.error) return <div className="pt-error" role="alert">{errorMessage(state.error)}</div>
  const p = state.patient
  return (
    <>
      <dl className="pt-kv">
        <dt>Patient code</dt><dd>{p.patient_code}</dd>
        <dt>Name</dt><dd>{fullName(p)}</dd>
        <dt>Date of birth</dt><dd>{fmtDate(p.birth_date)}</dd>
        <dt>Age</dt><dd>{p.age_years ?? '—'}</dd>
        <dt>Contact number</dt><dd>{p.contact_number || '—'}</dd>
        <dt>Address</dt><dd>{p.address || '—'}</dd>
        <dt>Registered</dt><dd>{fmtDate(p.registration_date)}</dd>
        <dt>Notes</dt><dd style={{ whiteSpace: 'pre-line' }}>{p.notes || '—'}</dd>
      </dl>
      <h3 className="pt-sub">Bite incidents</h3>
      {p.incidents == null ? (
        <p className="pt-hint">Your role cannot view incident records.</p>
      ) : p.incidents.length === 0 ? (
        <p className="pt-hint">No incidents recorded.</p>
      ) : (
        <table className="pt-mini">
          <thead><tr><th>Date</th><th>Animal</th><th>Injury</th><th>Body part</th></tr></thead>
          <tbody>
            {p.incidents.map((i) => (
              <tr key={i.id}><td>{fmtDate(i.incident_date)}</td><td>{label(i.animal_type)}</td><td>{label(i.injury_type)}</td><td>{i.body_part || '—'}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

export default function Patients() {
  const perms = getSession()?.user?.permissions || []
  const canManage = perms.includes('patients.manage')

  const [input, setInput] = useState('')
  const [term, setTerm] = useState('')
  const [page, setPage] = useState(1)
  const [reload, setReload] = useState(0)
  const [state, setState] = useState({ loading: true, data: null, error: null })
  const [modal, setModal] = useState(null) // { mode: 'add' | 'edit' | 'view', patient? }
  const [toast, setToast] = useState('')

  // wait a moment after typing before searching
  useEffect(() => {
    const t = setTimeout(() => { setTerm(input.trim()); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [input])

  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true, error: null }))
    staffPost('/patients/search', { search: term, page, per_page: PER_PAGE })
      .then((d) => { if (alive) setState({ loading: false, data: d, error: null }) })
      .catch((e) => { if (alive) setState({ loading: false, data: null, error: e }) })
    return () => { alive = false }
  }, [term, page, reload])

  useEffect(() => {
    if (!toast) return undefined
    const t = setTimeout(() => setToast(''), 3500)
    return () => clearTimeout(t)
  }, [toast])

  const close = useCallback(() => setModal(null), [])
  const { loading, data, error } = state
  const items = data?.items || []

  async function openEdit(p) {
    // load the full record (the list does not carry notes or birth date)
    try {
      const d = await staffPost('/patients/detail', { id: p.id })
      setModal({ mode: 'edit', patient: d.patient })
    } catch (e) {
      setToast(typeof errorMessage(e) === 'string' ? errorMessage(e) : 'Could not open this patient.')
    }
  }

  function saved(patient, wasEdit) {
    setModal(null)
    setToast(wasEdit ? 'Patient updated.' : `Patient registered (${patient.patient_code}).`)
    setReload((n) => n + 1)
  }

  return (
    <>
      <h1>Patients</h1>
      <p className="st-sub">Search, register, and update patient records.</p>

      <div className="pt-toolbar">
        <div className="pt-search">
          <SearchIcon size={18} strokeWidth={1.75} aria-hidden="true" />
          <label htmlFor="pt-q" className="sr-only">Search patients</label>
          <input id="pt-q" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Search name, code, or contact number" maxLength={100} />
          {input && (
            <button type="button" onClick={() => setInput('')} aria-label="Clear search"><X size={16} strokeWidth={1.75} aria-hidden="true" /></button>
          )}
        </div>
        {canManage && (
          <button type="button" className="btn btn-primary" onClick={() => setModal({ mode: 'add' })}>
            <Plus size={18} strokeWidth={1.75} aria-hidden="true" /> Register patient
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
                <th>Code</th><th>Name</th><th>Age</th><th>Contact</th><th>Address</th><th>Registered</th>
                <th>Cases</th><th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <tr className="pt-skelrow" key={i}>{Array.from({ length: 8 }).map((__, j) => <td key={j}><div /></td>)}</tr>
              ))}
              {!loading && items.map((p) => (
                <tr key={p.id}>
                  <td className="pt-code">{p.patient_code}</td>
                  <td><strong>{fullName(p)}</strong></td>
                  <td>{p.age_years ?? '—'}</td>
                  <td>{p.contact_number || '—'}</td>
                  <td>{p.address || '—'}</td>
                  <td>{fmtDate(p.registration_date)}</td>
                  <td>{p.incident_count ?? '—'}</td>
                  <td>
                    <div className="pt-actions">
                      <button type="button" className="pt-iconbtn" onClick={() => setModal({ mode: 'view', patient: p })} aria-label={`View ${fullName(p)}`}>
                        <EyeIcon size={16} strokeWidth={1.75} aria-hidden="true" /> View
                      </button>
                      {canManage && (
                        <button type="button" className="pt-iconbtn" onClick={() => openEdit(p)} aria-label={`Edit ${fullName(p)}`}>
                          <Pencil size={16} strokeWidth={1.75} aria-hidden="true" /> Edit
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && !error && items.length === 0 && (
            <div className="pt-empty">{term ? `No patients match “${term}”.` : 'No patients registered yet.'}</div>
          )}
        </div>

        {data && data.total > 0 && (
          <div className="pt-pager">
            <span>
              Showing {(data.page - 1) * data.per_page + 1}–{(data.page - 1) * data.per_page + items.length} of {data.total}
            </span>
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

      {modal?.mode === 'add' && (
        <Modal title="Register patient" onClose={close}><PatientForm onCancel={close} onSaved={saved} /></Modal>
      )}
      {modal?.mode === 'edit' && (
        <Modal title="Edit patient" onClose={close}><PatientForm patient={modal.patient} onCancel={close} onSaved={saved} /></Modal>
      )}
      {modal?.mode === 'view' && (
        <Modal title="Patient details" onClose={close}><PatientView id={modal.patient.id} /></Modal>
      )}

      {toast && <div className="pt-toast" role="status">{toast}</div>}
    </>
  )
}