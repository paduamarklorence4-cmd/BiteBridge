import { getSession } from './api'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000'

// Authenticated requests for staff pages. Returns the `data` field when present.
// Throws an Error with `.status` so pages can show a clear message.
async function request(method, path, body) {
  const session = getSession()
  const headers = { Authorization: `Bearer ${session?.accessToken || ''}`, Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let res
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    const err = new Error('Cannot reach the server. Check that the backend is running.')
    err.status = 0
    throw err
  }

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(json.error || json.message || `Request failed (${res.status})`)
    err.status = res.status
    throw err
  }
  return json.data ?? json
}

export const staffGet = (path) => request('GET', path)
export const staffPost = (path, body) => request('POST', path, body ?? {})