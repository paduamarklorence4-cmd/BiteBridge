import { API_URL } from '../config'

const KEY = 'bitebridge_session'

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || null
  } catch {
    return null
  }
}
export function clearSession() {
  localStorage.removeItem(KEY)
}

export async function login(username, password) {
  let res
  try {
    res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
  } catch {
    throw new Error('Cannot reach the server. Please check that the backend is running.')
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body.error || body.message || 'Sign-in failed. Please check your details.')
  }
const d = body.data || body
const t = d.tokens || d
const session = {
  accessToken: t.access_token || t.token,
  refreshToken: t.refresh_token,
  user: d.user || null,
}
  if (!session.accessToken) throw new Error('The server did not return an access token.')
  localStorage.setItem(KEY, JSON.stringify(session))
  return session
}

export async function logout() {
  const s = getSession()
  try {
    if (s?.refreshToken) {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: s.refreshToken }),
      })
    }
  } finally {
    clearSession()
  }
}
