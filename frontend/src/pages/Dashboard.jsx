import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as Lucide from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, PieChart, Pie, Legend,
} from 'recharts'
import { getSession } from '../services/api'
import { staffGet } from '../services/staffApi'
import './Dashboard.css'

// Some lucide-react versions renamed icons. This picks whichever name exists so the app never fails to build.
const pick = (...names) => names.map((n) => Lucide[n]).find(Boolean) || Lucide.Circle
const Users = pick('Users')
const FileText = pick('FileText')
const Calendar = pick('Calendar', 'CalendarDays')
const Syringe = pick('Syringe')
const AlertTriangle = pick('TriangleAlert', 'AlertTriangle')
const Package = pick('Package')
const Clock = pick('Clock')
const Receipt = pick('Receipt')

// Keys below are what GET /dashboard/stats returns. A null value means the role may not see that figure.
const CARDS = [
  { key: 'total_patients',      label: 'Registered patients',    icon: Users },
  { key: 'total_bite_cases',    label: 'Animal bite cases',      icon: FileText },
  { key: 'todays_appointments', label: "Today's appointments",   icon: Calendar },
  { key: 'upcoming_doses',      label: 'Upcoming vaccine doses', icon: Syringe, green: true },
  { key: 'overdue_followups',   label: 'Overdue follow-ups',     icon: AlertTriangle },
  { key: 'low_stock_items',     label: 'Low-stock items',        icon: Package },
  { key: 'near_expiry_items',   label: 'Near-expiry supplies',   icon: Clock },
  { key: 'total_collections',   label: 'Total collections',      icon: Receipt, money: true, green: true },
]
const num = new Intl.NumberFormat('en-PH')
const php = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })

const NAVY = '#0f2a44', RED = '#c62828', GREEN = '#1e7e34', AMBER = '#b7791f', GRAY = '#9aa5b1', ORANGE = '#e07b00'
const COLORS = {
  completed: GREEN, upcoming: NAVY, overdue: RED, missed: AMBER, cancelled: GRAY,
  scheduled: NAVY, rescheduled: AMBER, no_show: RED,
  ok: GREEN, low_stock: AMBER, near_expiry: ORANGE, expired: RED,
}

function ChartCard({ title, data, note, children }) {
  const hasData = Array.isArray(data) && data.some((d) => Number(d.value) > 0)
  return (
    <section className="st-card st-chart" aria-label={title}>
      <h2>{title}</h2>
      {data == null ? (
        <div className="st-empty">Your role cannot view this chart.</div>
      ) : !hasData ? (
        <div className="st-empty">No data yet.</div>
      ) : (
        <div className="st-chart-body">
          <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
        </div>
      )}
      {note && <p className="st-chart-note">{note}</p>}
    </section>
  )
}

function SimpleBar({ data, color, money }) {
  return (
    <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} />
      <XAxis dataKey="label" tick={{ fontSize: 12 }} interval={0} />
      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} width={money ? 64 : 36} />
      <Tooltip formatter={(v) => (money ? php.format(v) : num.format(v))} />
      <Bar dataKey="value" name={money ? 'Collected' : 'Count'} fill={color} radius={[4, 4, 0, 0]}>
        {data.map((d) => <Cell key={d.key || d.label} fill={COLORS[d.key] || color} />)}
      </Bar>
    </BarChart>
  )
}

export default function Dashboard() {
  const user = getSession()?.user || {}
  const [stats, setStats] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    staffGet('/dashboard/stats')
      .then((d) => { if (alive) setStats(d) })
      .catch((e) => { if (alive) setError(e) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  let notice = null
  if (error?.status === 401) {
    notice = <>Your session has expired. <Link to="/staff-login">Sign in again</Link>.</>
  } else if (error?.status === 403) {
    notice = 'Your role cannot view dashboard statistics.'
  } else if (error?.status === 404) {
    notice = 'The dashboard statistics API was not found on the backend, so no numbers are shown.'
  } else if (error) {
    notice = `Could not load statistics: ${error.message}`
  }

  const charts = stats?.charts || {}
  const chartsReady = !loading && !error

  return (
    <>
      <h1>Welcome, {user.full_name || user.username || 'staff'}</h1>
      <p className="st-sub">Overview of the center. Numbers come from the database.</p>

      {notice && <div className="st-card st-notice" role="alert" style={{ marginBottom: 20 }}>{notice}</div>}

      <div className="st-grid">
        {CARDS.map(({ key, label, icon: Icon, money, green }) => {
          const raw = stats?.[key]
          const value = raw == null ? '—' : money ? php.format(Number(raw)) : num.format(Number(raw))
          return (
            <div className="st-card st-stat" key={key}>
              <div className={`st-stat-icon${green ? ' green' : ''}`}><Icon size={22} strokeWidth={1.75} aria-hidden="true" /></div>
              <div>
                <div className="st-stat-label">{label}</div>
                <div className="st-stat-value">{loading ? <span className="st-skel" aria-label="Loading" /> : value}</div>
              </div>
            </div>
          )
        })}
      </div>
      {stats && (
        <p className="st-asof">
          Upcoming doses are scheduled within the next {stats.upcoming_window_days} days. Near-expiry means expiring
          within {stats.near_expiry_days} days. A dash means your role cannot view that figure.
        </p>
      )}

      {chartsReady && (
        <div className="st-charts">
          <ChartCard title="Monthly bite cases (last 6 months)" data={charts.monthly_bite_cases}>
            <SimpleBar data={charts.monthly_bite_cases || []} color={RED} />
          </ChartCard>

          <ChartCard title="Vaccination follow-up status" data={charts.followup_status}>
            <PieChart>
              <Pie data={charts.followup_status || []} dataKey="value" nameKey="label" innerRadius={50} outerRadius={85} paddingAngle={2}>
                {(charts.followup_status || []).map((d) => <Cell key={d.key} fill={COLORS[d.key] || GRAY} />)}
              </Pie>
              <Tooltip formatter={(v) => num.format(v)} />
              <Legend />
            </PieChart>
          </ChartCard>

          <ChartCard title="Appointments by status" data={charts.appointment_stats}>
            <SimpleBar data={charts.appointment_stats || []} color={NAVY} />
          </ChartCard>

          <ChartCard
            title="Inventory status"
            data={charts.inventory_status}
            note="An item can be both low-stock and near expiry, so the bars can overlap."
          >
            <SimpleBar data={charts.inventory_status || []} color={GREEN} />
          </ChartCard>

          <ChartCard title="Collections per month (last 6 months)" data={charts.monthly_collections}>
            <SimpleBar data={charts.monthly_collections || []} color={GREEN} money />
          </ChartCard>
        </div>
      )}
    </>
  )
}