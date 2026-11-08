import { useState } from 'react'
import { getSession } from '../services/api'
import './Staff.css'

/** tabs: [{ key, label, perm?, element }]  Only tabs the user has permission for are shown. */
export default function TabbedPage({ tabs }) {
  const perms = getSession()?.user?.permissions || []
  const visible = tabs.filter((t) => !t.perm || perms.includes(t.perm))
  const [active, setActive] = useState(visible[0]?.key)
  const current = visible.find((t) => t.key === active) || visible[0]
  if (!current) return <div className="st-card"><p>Your role does not include this page.</p></div>

  return (
    <>
      {visible.length > 1 && (
        <div className="st-tabs" role="tablist">
          {visible.map((t) => (
            <button key={t.key} type="button" role="tab" id={`tab-${t.key}`} aria-selected={t.key === current.key}
              className="st-tab" onClick={() => setActive(t.key)}>
              {t.label}
            </button>
          ))}
        </div>
      )}
      <div role="tabpanel" aria-labelledby={`tab-${current.key}`} key={current.key}>{current.element}</div>
    </>
  )
}