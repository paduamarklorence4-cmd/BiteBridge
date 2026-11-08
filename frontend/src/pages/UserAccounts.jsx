import { useEffect, useState } from 'react'
import ResourcePage, { Badge, errorMessage, label } from '../components/ResourcePage'
import TabbedPage from '../components/TabbedPage'
import { staffPost } from '../services/staffApi'

const tone = { active: 'green', inactive: 'gray', suspended: 'red' }

function PermGroups({ permissions, checked, locked, onToggle }) {
  const groups = {}
  permissions.forEach((p) => { (groups[p.module] = groups[p.module] || []).push(p) })
  return (
    <>
      {Object.entries(groups).map(([module, list]) => (
        <div className="st-perm-group" key={module}>
          <h3>{module}</h3>
          <div className="st-perm-list">
            {list.map((p) => (
              <label key={p.id} title={p.description || ''}>
                <input type="checkbox" checked={checked.has(p.id)} disabled={locked?.has(p.id)} onChange={() => onToggle(p.id)} />
                <span>{p.description || p.code}<span className="pt-hint"> ({p.code})</span></span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}

function UserPermissions({ row, ctx }) {
  const [state, setState] = useState({ loading: true, perms: [], error: null })
  const [checked, setChecked] = useState(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    staffPost('/users/user-permissions', { user_id: row.id })
      .then((d) => {
        if (!alive) return
        setState({ loading: false, perms: d.permissions, error: null })
        setChecked(new Set(d.permissions.filter((p) => p.via_role || p.extra).map((p) => p.id)))
      })
      .catch((e) => { if (alive) setState({ loading: false, perms: [], error: e }) })
    return () => { alive = false }
  }, [row.id])

  const locked = new Set(state.perms.filter((p) => p.via_role).map((p) => p.id))
  const toggle = (id) => setChecked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  async function save() {
    setSaving(true); setError(null)
    try {
      const extras = [...checked].filter((id) => !locked.has(id))
      await staffPost('/users/save-user-permissions', { user_id: row.id, permission_ids: extras })
      ctx.done('Permissions saved. They apply the next time this person signs in.')
    } catch (err) { setError(errorMessage(err)); setSaving(false) }
  }

  if (state.loading) return <p>Loading…</p>
  if (state.error) return <div className="pt-error" role="alert">{errorMessage(state.error)}</div>
  return (
    <>
      {error && <div className="pt-error" role="alert">{error}</div>}
      <p><strong>{row.full_name}</strong> ({row.role_label}). Checked and greyed items come from the role. Check more to give this person extra access, which is how Staff accounts get their modules.</p>
      <PermGroups permissions={state.perms} checked={checked} locked={locked} onToggle={toggle} />
      <div className="pt-form-actions">
        <button type="button" className="btn btn-outline" onClick={ctx.close} disabled={saving}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save permissions'}</button>
      </div>
    </>
  )
}

function RolePermissions() {
  const [roles, setRoles] = useState({ loading: true, items: [], error: null })
  const [roleId, setRoleId] = useState('')
  const [perms, setPerms] = useState({ loading: false, items: [], error: null })
  const [checked, setChecked] = useState(new Set())
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)

  useEffect(() => {
    let alive = true
    staffPost('/users/roles', {})
      .then((d) => { if (alive) { setRoles({ loading: false, items: d.items || [], error: null }); setRoleId(String(d.items?.[0]?.id || '')) } })
      .catch((e) => { if (alive) setRoles({ loading: false, items: [], error: e }) })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!roleId) return undefined
    let alive = true
    setPerms((s) => ({ ...s, loading: true, error: null })); setMsg(null)
    staffPost('/users/role-permissions', { role_id: Number(roleId) })
      .then((d) => { if (alive) { setPerms({ loading: false, items: d.permissions, error: null }); setChecked(new Set(d.selected)) } })
      .catch((e) => { if (alive) setPerms({ loading: false, items: [], error: e }) })
    return () => { alive = false }
  }, [roleId])

  const toggle = (id) => setChecked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  async function save() {
    setSaving(true); setMsg(null)
    try {
      await staffPost('/users/save-role-permissions', { role_id: Number(roleId), permission_ids: [...checked] })
      setMsg({ ok: true, text: 'Role permissions saved. People with this role get them the next time they sign in.' })
    } catch (err) { setMsg({ ok: false, text: errorMessage(err) }) }
    finally { setSaving(false) }
  }

  const select = { padding: '10px 12px', border: '1px solid #d9e2ec', borderRadius: 8, font: 'inherit', background: '#fff' }
  return (
    <>
      <h1>Role permissions</h1>
      <p className="st-sub">Choose what each role can access. The server checks these on every request.</p>
      {roles.error && <div className="st-card st-notice" role="alert">{errorMessage(roles.error)}</div>}
      <div className="st-card">
        <div className="pt-field" style={{ maxWidth: 320, marginBottom: 16 }}>
          <label htmlFor="rp-role">Role</label>
          <select id="rp-role" value={roleId} onChange={(e) => setRoleId(e.target.value)} style={select}>
            {roles.items.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>
        {perms.loading && <p>Loading…</p>}
        {perms.error && <div className="pt-error" role="alert">{errorMessage(perms.error)}</div>}
        {!perms.loading && !perms.error && perms.items.length > 0 && (
          <>
            <PermGroups permissions={perms.items} checked={checked} onToggle={toggle} />
            {msg && <div className={msg.ok ? 'pt-hint' : 'pt-error'} role="status">{msg.text}</div>}
            <div className="pt-form-actions">
              <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save role permissions'}</button>
            </div>
          </>
        )}
      </div>
    </>
  )
}

const accounts = {
  title: 'User Accounts',
  subtitle: 'Create staff accounts, assign roles, and manage status. Accounts are deactivated rather than deleted so records keep their history.',
  singular: 'account',
  base: '/users',
  perms: { view: 'users.manage', manage: 'users.manage' },
  searchPlaceholder: 'Search name, username, email, or role',
  filters: [{ key: 'status', label: 'Status', options: ['active', 'inactive', 'suspended'].map((v) => ({ value: v, label: label(v) })) }],
  columns: [
    { key: 'full_name', label: 'Name', render: (r) => (<><strong>{r.full_name}</strong><div className="pt-hint">{r.username}</div></>) },
    { key: 'email', label: 'Email' },
    { key: 'role_label', label: 'Role' },
    { key: 'status', label: 'Status', render: (r) => <Badge tone={tone[r.status] || 'gray'}>{label(r.status)}</Badge> },
    { key: 'last_login_at', label: 'Last sign-in', type: 'datetime' },
  ],
  fields: [
    { key: 'full_name', label: 'Full name', type: 'text', maxLength: 120, required: true },
    { key: 'username', label: 'Username', type: 'text', maxLength: 50, required: true, hint: 'Letters, numbers, dot, dash, or underscore.' },
    { key: 'email', label: 'Email', type: 'text', maxLength: 120, required: true },
    { key: 'contact_number', label: 'Contact number', type: 'text', maxLength: 20 },
    { key: 'role_id', label: 'Role', type: 'ref', lookup: 'roles', labelKey: 'role_label', required: true },
    { key: 'status', label: 'Status', type: 'select', options: ['active', 'inactive', 'suspended'].map((v) => ({ value: v, label: label(v) })) },
    { key: 'password', label: 'Password', type: 'password', maxLength: 72, hint: 'Required for a new account: at least 8 characters with a letter and a number. When editing, leave blank to keep the current password.' },
  ],
  details: [
    { key: 'full_name', label: 'Name' }, { key: 'username', label: 'Username' }, { key: 'email', label: 'Email' },
    { key: 'contact_number', label: 'Contact number' }, { key: 'role_label', label: 'Role' },
    { key: 'status', label: 'Status', type: 'enum' }, { key: 'last_login_at', label: 'Last sign-in', type: 'datetime' },
  ],
  actions: [
    { label: 'Access', perm: 'roles.manage', title: 'Extra access for this person', render: (row, ctx) => <UserPermissions row={row} ctx={ctx} /> },
  ],
}

export default function UserAccounts() {
  return (
    <TabbedPage tabs={[
      { key: 'accounts', label: 'Accounts', perm: 'users.manage', element: <ResourcePage cfg={accounts} /> },
      { key: 'roles', label: 'Role permissions', perm: 'roles.manage', element: <RolePermissions /> },
    ]} />
  )
}