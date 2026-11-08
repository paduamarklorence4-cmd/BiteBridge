import { useEffect, useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Menu, ChevronLeft, LogOut } from 'lucide-react'
import { getSession, logout } from '../services/api'
import { STAFF_NAV } from '../staffNav'
import './staff.css'

const COLLAPSE_KEY = 'bb_sidebar_collapsed'

function readCollapsed() {
  try { return localStorage.getItem(COLLAPSE_KEY) === '1' } catch { return false }
}

export default function StaffLayout() {
  const nav = useNavigate()
  const { pathname } = useLocation()
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [drawer, setDrawer] = useState(false)
  const [menu, setMenu] = useState(false)

  useEffect(() => { setDrawer(false); setMenu(false) }, [pathname])
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') { setDrawer(false); setMenu(false) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const session = getSession()
  if (!session) return <Navigate to="/staff-login" replace />

  const user = session.user || {}
  const perms = Array.isArray(user.permissions) ? user.permissions : []
  const items = STAFF_NAV.filter((i) => perms.includes(i.perm))
  const current = STAFF_NAV.find((i) => pathname === i.to || pathname.startsWith(i.to + '/'))
  const allowed = !current || perms.includes(current.perm)

  function toggleCollapse() {
    const next = !collapsed
    setCollapsed(next)
    try { localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0') } catch { /* ignore */ }
  }

  async function signOut() {
    await logout()
    nav('/staff-login')
  }

  return (
    <div className={`st-shell${collapsed ? ' st-collapsed' : ''}${drawer ? ' st-drawer-open' : ''}`}>
      <aside className="st-sidebar" aria-label="Staff navigation">
        <div className="st-brand">
          <img src="/images/ez-animal-bite-center-logo.png" alt="EZ Animal Bite Center" />
          <span className="st-brand-text">EZ Animal Bite Center</span>
        </div>
        <nav>
          <ul>
            {items.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink to={to} className={({ isActive }) => `st-link${isActive ? ' active' : ''}`} title={label}>
                  <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
                  <span className="st-link-text">{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <button type="button" className="st-collapse" onClick={toggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
          <span className="st-link-text">Collapse</span>
        </button>
      </aside>
      {drawer && <div className="st-overlay" onClick={() => setDrawer(false)} aria-hidden="true" />}

      <div className="st-main">
        <header className="st-topbar">
          <button type="button" className="st-iconbtn st-menu-btn" onClick={() => setDrawer(true)} aria-label="Open menu">
            <Menu size={22} strokeWidth={1.75} aria-hidden="true" />
          </button>
          <nav aria-label="Breadcrumb" className="st-crumbs">
            <span>Staff</span>
            <span aria-hidden="true">/</span>
            <strong>{current ? current.label : 'Dashboard'}</strong>
          </nav>
          <div className="st-user">
            <button type="button" className="st-userbtn" aria-haspopup="menu" aria-expanded={menu}
              onClick={() => setMenu((m) => !m)}>
              <span className="st-avatar" aria-hidden="true">{(user.username || '?').slice(0, 1).toUpperCase()}</span>
              <span className="st-username">{user.username || 'Staff'}</span>
            </button>
            {menu && (
              <div className="st-menu" role="menu">
                <div className="st-menu-info">
                  <strong>{user.full_name || user.username}</strong>
                  <span>{user.role}</span>
                </div>
                <button type="button" role="menuitem" onClick={signOut}>
                  <LogOut size={16} strokeWidth={1.75} aria-hidden="true" /> Sign out
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="st-content" id="content">
          {allowed ? <Outlet /> : (
            <div className="st-card">
              <h1>No access</h1>
              <p>Your role does not include this page. Contact the Superadmin if you need access.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}