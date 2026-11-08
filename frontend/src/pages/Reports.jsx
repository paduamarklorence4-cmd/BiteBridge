import { useEffect, useState } from 'react'
import { staffPost } from '../services/staffApi'
import { errorMessage, fmtDate, label, money, todayStr } from '../components/ResourcePage'

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  const p = (x) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function show(col, v) {
  if (v === null || v === undefined || v === '') return '—'
  if (col.type === 'date') return fmtDate(v)
  if (col.type === 'money') return money(v)
  if (typeof v === 'string' && /^[a-z_]+$/.test(v)) return label(v)
  return v
}

// Spreadsheet programs treat cells that start with = + - @ as formulas, so those get a leading quote.
function csvCell(v) {
  let s = v === null || v === undefined ? '' : String(v)
  if (/^[=+\-@]/.test(s)) s = `'${s}`
  return `"${s.replace(/"/g, '""')}"`
}

function exportCsv(result) {
  const head = result.columns.map((c) => csvCell(c.label)).join(',')
  const body = result.rows.map((r) => result.columns.map((c) => csvCell(r[c.key])).join(',')).join('\r\n')
  const blob = new Blob([`\uFEFF${head}\r\n${body}`], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${result.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${todayStr()}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function Reports() {
  const [list, setList] = useState({ loading: true, items: [], error: null })
  const [report, setReport] = useState('')
  const [from, setFrom] = useState(daysAgo(30))
  const [to, setTo] = useState(todayStr())
  const [result, setResult] = useState(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    staffPost('/reports/catalog', {})
      .then((d) => { if (alive) { setList({ loading: false, items: d.items || [], error: null }); setReport(d.items?.[0]?.key || '') } })
      .catch((e) => { if (alive) setList({ loading: false, items: [], error: e }) })
    return () => { alive = false }
  }, [])

  const current = list.items.find((r) => r.key === report)

  async function run(e) {
    e?.preventDefault()
    setRunning(true); setError(null)
    try {
      setResult(await staffPost('/reports/run', { report, from, to }))
    } catch (err) {
      setError(err); setResult(null)
    } finally {
      setRunning(false)
    }
  }

  const select = { padding: '10px 12px', border: '1px solid #d9e2ec', borderRadius: 8, font: 'inherit', background: '#fff' }
  return (
    <>
      <h1>Reports</h1>
      <p className="st-sub st-noprint">Database-backed reports with a date range. You can export a report as CSV or print it.</p>

      {list.error && <div className="st-card st-notice" role="alert">{errorMessage(list.error)}</div>}
      {!list.loading && !list.error && list.items.length === 0 && (
        <div className="st-card"><p style={{ margin: 0 }}>Your role does not include any report.</p></div>
      )}

      {list.items.length > 0 && (
        <form className="st-card st-noprint" onSubmit={run}>
          <div className="st-formrow">
            <div className="pt-field">
              <label htmlFor="rp-type">Report</label>
              <select id="rp-type" value={report} onChange={(e) => { setReport(e.target.value); setResult(null) }} style={select}>
                {list.items.map((r) => <option key={r.key} value={r.key}>{r.title}</option>)}
              </select>
            </div>
            {current?.uses_dates && (
              <>
                <div className="pt-field"><label htmlFor="rp-from">From</label><input id="rp-from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></div>
                <div className="pt-field"><label htmlFor="rp-to">To</label><input id="rp-to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} /></div>
              </>
            )}
            <button type="submit" className="btn btn-primary" disabled={running || !report}>{running ? 'Running…' : 'Run report'}</button>
          </div>
          {current && !current.uses_dates && <p className="pt-hint" style={{ margin: 0 }}>This report shows the current stock, so it has no date range.</p>}
        </form>
      )}

      {error && <div className="st-card st-notice" role="alert" style={{ marginTop: 16 }}>{errorMessage(error)}</div>}

      {result && (
        <div className="st-card" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0 }}>{result.title}</h2>
              <p className="pt-hint" style={{ margin: 0 }}>
                {result.from ? `${fmtDate(result.from)} to ${fmtDate(result.to)}` : 'Current stock'}. Created {fmtDate(todayStr())}.
              </p>
            </div>
            <div className="st-noprint" style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-outline" onClick={() => exportCsv(result)} disabled={result.rows.length === 0}>Export CSV</button>
              <button type="button" className="btn btn-outline" onClick={() => window.print()}>Print</button>
            </div>
          </div>

          <div className="st-report-grid">
            {result.summary.map((s) => (
              <div className="st-report-stat" key={s.label}><span>{s.label}</span><strong>{s.value}</strong></div>
            ))}
          </div>
          {result.truncated && <p className="pt-hint">Only the first 1,000 rows are shown. Use a shorter date range for the full list.</p>}

          {result.rows.length === 0 ? (
            <div className="pt-empty">No records in this range.</div>
          ) : (
            <div className="pt-tablewrap">
              <table className="pt-table" style={{ minWidth: 640 }}>
                <thead><tr>{result.columns.map((c) => <th key={c.key}>{c.label}</th>)}</tr></thead>
                <tbody>
                  {result.rows.map((r, i) => (
                    <tr key={i}>{result.columns.map((c) => <td key={c.key}>{show(c, r[c.key])}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  )
}