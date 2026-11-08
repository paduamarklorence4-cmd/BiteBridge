import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { LogIn } from 'lucide-react'
import { login, getSession } from '../services/api'

export default function StaffLogin() {
  const nav = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (getSession()) return <Navigate to="/dashboard" replace />

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (!username.trim() || !password) {
      setError('Enter your username and password.')
      return
    }
    setBusy(true)
    try {
      await login(username.trim(), password)
      nav('/dashboard')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="section login-wrap">
      <div className="container narrow-sm">
        <form className="card login-card" onSubmit={submit} noValidate>
          <h1 className="login-title">Staff Login</h1>
          <p className="muted">For authorized clinic staff only.</p>

          <label htmlFor="username">Username</label>
          <input id="username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />

          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />

          {error && <p className="form-error" role="alert">{error}</p>}

          <button className="btn btn-primary btn-block" disabled={busy}>
            <LogIn size={18} strokeWidth={1.75} aria-hidden="true" /> {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </section>
  )
}
