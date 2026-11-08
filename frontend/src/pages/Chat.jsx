import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import * as Lucide from 'lucide-react'
import { CLINIC } from '../config'
import PageHeader from './PageHeader'
import './ChatFlow.css'

const pick = (...names) => names.map((n) => Lucide[n]).find(Boolean) || Lucide.Circle
const Send = pick('Send')
const MessageCircle = pick('MessageCircle')
const ShieldCheck = pick('ShieldCheck')
const Camera = pick('Camera', 'ImagePlus')
const Copy = pick('Copy')
const Printer = pick('Printer')

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000'
const QUICK = ['Clinic hours', 'Where is the clinic?', 'First aid steps', 'Phone number']
const CONSENT_KEY = 'bb_chat_consent'
const TOKEN_KEY = 'bb_chat_token'

// The questions. Values must match the backend (ChatController::QUESTIONS).
const QUESTIONS = [
  { key: 'animal', en: 'What animal was it?', fil: 'Anong hayop ito?', options: [
    { v: 'dog', en: 'Dog', fil: 'Aso' }, { v: 'cat', en: 'Cat', fil: 'Pusa' }, { v: 'other', en: 'Other animal', fil: 'Ibang hayop' },
  ] },
  { key: 'animal_status', en: 'Does the animal have an owner? Is it vaccinated?', fil: 'May-ari ba ang hayop? May bakuna ba ito?', options: [
    { v: 'owned_vaccinated', en: 'Has an owner, vaccinated', fil: 'May-ari, may bakuna' },
    { v: 'owned_unknown', en: 'Has an owner, not sure if vaccinated', fil: 'May-ari, hindi sigurado kung may bakuna' },
    { v: 'stray', en: 'Stray (no owner)', fil: 'Gala (walang may-ari)' },
    { v: 'unknown', en: 'I do not know', fil: 'Hindi ko alam' },
  ] },
  { key: 'exposure', en: 'What happened?', fil: 'Ano ang nangyari?', options: [
    { v: 'bite_broke_skin', en: 'Bite that broke the skin', fil: 'Kagat na nakasugat sa balat' },
    { v: 'scratch_bleeding', en: 'Scratch with bleeding', fil: 'Kalmot na may dugo' },
    { v: 'scratch_no_bleeding', en: 'Scratch without bleeding', fil: 'Kalmot na walang dugo' },
    { v: 'nibble_no_break', en: 'Bite or nibble that did not break the skin', fil: 'Kagat na hindi nakasugat sa balat' },
    { v: 'lick_broken_skin', en: 'Saliva on a cut or broken skin', fil: 'Laway sa hiwa o sugat' },
    { v: 'lick_mucous', en: 'Saliva in the eyes, nose, or mouth', fil: 'Laway sa mata, ilong, o bibig' },
    { v: 'lick_intact', en: 'Lick on unbroken skin', fil: 'Dinilaan ang buong balat' },
    { v: 'touch_feed', en: 'Only touched or fed the animal', fil: 'Hinawakan o pinakain lang ang hayop' },
  ] },
  { key: 'body_part', en: 'Where on the body?', fil: 'Saang bahagi ng katawan?', options: [
    { v: 'head_face_neck', en: 'Head, face, or neck', fil: 'Ulo, mukha, o leeg' },
    { v: 'hand_fingers', en: 'Hand or fingers', fil: 'Kamay o daliri' },
    { v: 'arm', en: 'Arm', fil: 'Braso' },
    { v: 'leg_foot', en: 'Leg or foot', fil: 'Binti o paa' },
    { v: 'trunk', en: 'Body (trunk)', fil: 'Katawan' },
    { v: 'other', en: 'Other', fil: 'Iba pa' },
  ] },
  { key: 'when', en: 'When did it happen?', fil: 'Kailan ito nangyari?', options: [
    { v: 'today', en: 'Today', fil: 'Ngayong araw' },
    { v: '1_3_days', en: '1 to 3 days ago', fil: '1 hanggang 3 araw na ang nakalipas' },
    { v: 'more_3_days', en: 'More than 3 days ago', fil: 'Higit 3 araw na ang nakalipas' },
  ] },
  { key: 'bleeding', en: 'Is it bleeding?', fil: 'Dumudugo ba?', options: [
    { v: 'none', en: 'No bleeding', fil: 'Walang dugo' },
    { v: 'light', en: 'Light bleeding', fil: 'Kaunting dugo' },
    { v: 'heavy', en: 'Heavy bleeding', fil: 'Maraming dugo' },
  ] },
  { key: 'washed', en: 'Did you already wash the wound with soap and running water?', fil: 'Nahugasan mo na ba ang sugat ng sabon at umaagos na tubig?', options: [
    { v: 'yes', en: 'Yes', fil: 'Oo' }, { v: 'no', en: 'Not yet', fil: 'Hindi pa' },
  ] },
]

// Used only when the AI service cannot be reached.
function presetReply(q) {
  const t = q.toLowerCase()
  if (/(hour|open|close|schedule|time)/.test(t))
    return 'We are open Monday to Saturday from 8:00 AM to 5:00 PM, and on Sunday from 8:00 AM to 12:00 NN.'
  if (/(where|location|address|direction|map|find)/.test(t))
    return `The clinic is at ${CLINIC.address}. You can open directions on the Location page.`
  if (/(phone|call|number|contact|mobile)/.test(t))
    return `You can call the clinic at ${CLINIC.phoneDisplay} during operating hours.`
  if (/(email|mail)/.test(t)) return `You can email the clinic at ${CLINIC.email}.`
  if (/(facebook|page|social)/.test(t)) return `Our Facebook page is named ${CLINIC.facebookName}.`
  if (/(first aid|wash|wound|bleed|bite|scratch|rabies|dog|cat)/.test(t))
    return 'Wash the wound with soap and running water for about 15 minutes, cover it with a clean dressing, and get a medical assessment promptly. Open the First Aid Guide for the full steps. This is general information, not medical advice.'
  return `I can help with clinic hours, location, contact details, and first aid basics. For anything else, please call ${CLINIC.phoneDisplay} during operating hours.`
}

async function api(path, body, { form = false, timeout = 30000 } = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: 'POST',
      headers: form ? undefined : { 'Content-Type': 'application/json' },
      body: form ? body : JSON.stringify(body),
      signal: ctrl.signal,
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
      const err = new Error(json?.error || json?.message || `HTTP ${res.status}`)
      err.status = res.status
      throw err
    }
    if (json === null) {
      // The server answered, but not with JSON (for example a PHP error page).
      const err = new Error('The server sent an unexpected response.')
      err.status = 502
      throw err
    }
    return json.data ?? json
  } finally {
    clearTimeout(timer)
  }
}

// Phone photos are large. Shrink to at most 1600 px before uploading.
async function shrink(file) {
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85))
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file
  }
}

const readFlag = (k) => { try { return sessionStorage.getItem(k) } catch { return null } }
const writeFlag = (k, v) => { try { sessionStorage.setItem(k, v) } catch { /* ignore */ } }

function Assessment({ withSession, onCancel, onDone }) {
  const [step, setStep] = useState(0)
  const [ans, setAns] = useState({})
  const [name, setName] = useState('')
  const [number, setNumber] = useState('')
  const [photo, setPhoto] = useState(null)
  const [photoUrl, setPhotoUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const total = QUESTIONS.length
  const contact = step === total

  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl) }, [photoUrl])

  function choose(key, v) {
    setAns((a) => ({ ...a, [key]: v }))
    setStep((s) => s + 1)
  }

  async function onFile(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    if (!f.type.startsWith('image/')) { setError('Please choose an image file.'); return }
    setError(null)
    const small = await shrink(f)
    if (photoUrl) URL.revokeObjectURL(photoUrl)
    setPhoto(small)
    setPhotoUrl(URL.createObjectURL(small))
  }

  async function submit(e) {
    e.preventDefault()
    if (number && !/^\+?\d{7,15}$/.test(number.replace(/[\s\-()]/g, ''))) {
      setError('Contact number must be 7 to 15 digits. You can also leave it blank.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const d = await withSession(async (token) => {
        const fd = new FormData()
        fd.append('session_token', token)
        fd.append('answers', JSON.stringify(ans))
        fd.append('contact_name', name)
        fd.append('contact_number', number)
        if (photo) fd.append('photo', photo, 'wound.jpg')
        return api('/chat/assessment', fd, { form: true, timeout: 30000 })
      })
      onDone(d)
    } catch (err) {
      setError(err.message || 'Your summary could not be saved. Please try again.')
      setSaving(false)
    }
  }

  const q = QUESTIONS[step]
  return (
    <div className="cf-card">
      <p className="cf-hint" style={{ margin: 0 }}>
        {contact ? 'Last step' : `Question ${step + 1} of ${total}`}. These answers help our nurse or physician prepare for your visit. They are not a diagnosis.
      </p>
      <div className="cf-progress" aria-hidden="true"><div style={{ width: `${(Math.min(step, total) / total) * 100}%` }} /></div>
      {error && <div className="cf-error" role="alert">{error}</div>}

      {!contact && (
        <>
          <p className="cf-q">{q.en}</p>
          <p className="cf-q-fil">{q.fil}</p>
          <div className="cf-opts" role="group" aria-label={q.en}>
            {q.options.map((o) => (
              <button key={o.v} type="button" className="cf-opt" onClick={() => choose(q.key, o.v)}>
                {o.en}<small>{o.fil}</small>
              </button>
            ))}
          </div>
          <div className="cf-actions">
            <button type="button" className="btn btn-outline" onClick={step === 0 ? onCancel : () => setStep(step - 1)}>
              {step === 0 ? 'Back to chat' : 'Back'}
            </button>
          </div>
        </>
      )}

      {contact && (
        <form onSubmit={submit}>
          <p className="cf-q">For follow-up (optional)</p>
          <p className="cf-q-fil">Para sa follow-up (hindi kailangan)</p>
          <div className="cf-field">
            <label htmlFor="cf-name">Name</label>
            <input id="cf-name" type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="name" />
          </div>
          <div className="cf-field">
            <label htmlFor="cf-num">Contact number</label>
            <input id="cf-num" type="tel" value={number} onChange={(e) => setNumber(e.target.value)} maxLength={20} autoComplete="tel" />
            <div className="cf-hint">Used only by the center for your care and vaccination reminders. See the <Link to="/privacy">Privacy Notice</Link>.</div>
          </div>
          <div className="cf-field">
            <label htmlFor="cf-photo">Photo of the wound (optional)</label>
            <input id="cf-photo" type="file" accept="image/*" onChange={onFile} />
            <div className="cf-hint">Only center staff can see it. Do not include faces or other people.</div>
            {photoUrl && (
              <div className="cf-thumb">
                <img src={photoUrl} alt="Selected wound" />
                <button type="button" className="btn btn-outline" onClick={() => { setPhoto(null); setPhotoUrl('') }}>Remove photo</button>
              </div>
            )}
          </div>
          <div className="cf-actions">
            <button type="button" className="btn btn-outline" onClick={() => setStep(total - 1)} disabled={saving}>Back</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save my summary'}</button>
          </div>
        </form>
      )}
    </div>
  )
}

function ReferenceResult({ result, onBack }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try { await navigator.clipboard.writeText(result.reference_code); setCopied(true) } catch { setCopied(false) }
  }
  return (
    <div className="cf-card">
      <h2 style={{ marginTop: 0 }}>Your summary is saved</h2>
      <p>Show this reference code at the center, and use it to view your summary again. Please keep it.</p>
      <div className="cf-ref"><strong>{result.reference_code}</strong><span className="cf-hint">Valid for {result.valid_days} days</span></div>
      <div className="cf-summary">{result.summary}</div>
      <div className="cf-actions cf-noprint">
        <button type="button" className="btn btn-outline" onClick={onBack}>Back to chat</button>
        <span style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="btn btn-outline" onClick={copy}><Copy size={16} strokeWidth={1.75} aria-hidden="true" /> {copied ? 'Copied' : 'Copy code'}</button>
          <button type="button" className="btn btn-outline" onClick={() => window.print()}><Printer size={16} strokeWidth={1.75} aria-hidden="true" /> Print</button>
        </span>
      </div>
    </div>
  )
}

function Retrieve({ onBack }) {
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [res, setRes] = useState(null)
  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError(null); setRes(null)
    try { setRes(await api('/chat/retrieve', { code })) } catch (err) { setError(err.message || 'Something went wrong.') } finally { setBusy(false) }
  }
  return (
    <div className="cf-card">
      <h2 style={{ marginTop: 0 }}>View my saved summary</h2>
      <p>Enter the reference code you received, for example BB-7K3M9P2X.</p>
      <form onSubmit={submit}>
        {error && <div className="cf-error" role="alert">{error}</div>}
        <div className="cf-field">
          <label htmlFor="cf-code">Reference code</label>
          <input id="cf-code" type="text" value={code} onChange={(e) => setCode(e.target.value)} maxLength={20} autoComplete="off" />
        </div>
        <div className="cf-actions">
          <button type="button" className="btn btn-outline" onClick={onBack}>Back</button>
          <button type="submit" className="btn btn-primary" disabled={busy || !code.trim()}>{busy ? 'Looking…' : 'View summary'}</button>
        </div>
      </form>
      {res && (
        <div style={{ marginTop: 16 }}>
          <div className="cf-summary">{res.summary}</div>
          <div className="cf-actions cf-noprint"><span /><button type="button" className="btn btn-outline" onClick={() => window.print()}><Printer size={16} strokeWidth={1.75} aria-hidden="true" /> Print</button></div>
        </div>
      )}
    </div>
  )
}

export default function Chat() {
  const [consented, setConsented] = useState(() => readFlag(CONSENT_KEY) === 'yes')
  const [agree, setAgree] = useState(false)
  const [mode, setMode] = useState('chat') // chat | assess | done | retrieve
  const [result, setResult] = useState(null)
  const [msgs, setMsgs] = useState([
    { from: 'bot', text: 'Hello! I can answer basic questions about the clinic. I cannot give medical advice or diagnose a condition.' },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [aiDown, setAiDown] = useState(false)
  const [slow, setSlow] = useState(false)
  const [offline, setOffline] = useState(false)
  const tokenRef = useRef(readFlag(TOKEN_KEY) || '')
  const starting = useRef(false)
  const end = useRef(null)

  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [msgs])

  const startSession = useCallback(async () => {
    const d = await api('/chat/start', { consent: true, language: 'en' })
    if (!d.session_token) throw new Error('The chat session could not be started.')
    tokenRef.current = d.session_token
    writeFlag(TOKEN_KEY, d.session_token)
    setOffline(false)
    return d.session_token
  }, [])

  useEffect(() => {
    if (!consented || tokenRef.current || starting.current) return
    starting.current = true
    startSession().catch((e) => { console.error('Chat start failed:', e); setOffline(true) }).finally(() => { starting.current = false })
  }, [consented, startSession])

  // Runs a request with the session token. If the session expired (410), starts a new one and tries once more.
  const withSession = useCallback(async (fn) => {
    if (!tokenRef.current) await startSession()
    try {
      return await fn(tokenRef.current)
    } catch (e) {
      if (e.status === 410) return fn(await startSession())
      throw e
    }
  }, [startSession])

  async function send(text) {
    const q = text.trim()
    if (!q || busy) return
    setMsgs((m) => [...m, { from: 'user', text: q }])
    setInput('')
    setBusy(true)
    const slowTimer = setTimeout(() => setSlow(true), 6000)
    try {
      if (offline) throw new Error('offline')
      const d = await withSession((t) => api('/chat/message', { session_token: t, message: q }, { timeout: 75000 }))
      setAiDown(false)
      setMsgs((m) => [...m, { from: 'bot', text: d.reply, assess: Boolean(d.offer_assessment) }])
    } catch (err) {
      console.error('Chat API error:', err)
      setAiDown(true)
      setMsgs((m) => [...m, { from: 'bot', text: presetReply(q) }])
    } finally {
      clearTimeout(slowTimer)
      setSlow(false)
      setBusy(false)
    }
  }

  function startAssessment() {
    if (offline) {
      setMsgs((m) => [...m, { from: 'bot', text: `The clinic system is not available right now, so I cannot save your answers. Please wash the wound with soap and running water for about 15 minutes, then call ${CLINIC.phoneDisplay} or go to the center.` }])
      return
    }
    setMode('assess')
  }

  function accept() {
    writeFlag(CONSENT_KEY, 'yes')
    setConsented(true)
  }

  if (mode === 'retrieve') {
    return (
      <>
        <PageHeader title="Chat with Us" text="View your saved first aid summary." />
        <section className="section"><div className="container narrow"><Retrieve onBack={() => setMode('chat')} /></div></section>
      </>
    )
  }

  if (!consented) {
    return (
      <>
        <PageHeader title="Chat with Us" text="Quick answers about hours, location, and basic first aid." />
        <section className="section">
          <div className="container narrow">
            <div className="card">
              <h2>
                <ShieldCheck size={22} strokeWidth={1.75} aria-hidden="true" className="inline-icon" /> Before we start
              </h2>
              <p>
                This chat gives general information only. It does not diagnose or replace care from our nurse or
                physician. Your messages are saved so center staff can review them, and only authorized staff can see
                them. If you choose to share your name, contact number, or a wound photo, they are used only for your care.
              </p>
              <p><Link to="/privacy">Read the full Privacy Notice</Link></p>
              <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', margin: '16px 0' }}>
                <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 4 }} />
                <span>I have read the Privacy Notice and I agree to continue.</span>
              </label>
              <button type="button" className="btn btn-primary" disabled={!agree} onClick={accept}>Start chat</button>
              <p className="fineprint">
                If this is an emergency or the bleeding will not stop, call the center at {CLINIC.phoneDisplay} or go to the nearest hospital.
              </p>
              <p className="fineprint">
                Already have a reference code?{' '}
                <button type="button" className="cf-link" onClick={() => setMode('retrieve')}>View my saved summary</button>
              </p>
            </div>
          </div>
        </section>
      </>
    )
  }

  return (
    <>
      <PageHeader title="Chat with Us" text="Quick answers about hours, location, and first aid." />
      <section className="section">
        <div className="container narrow">
          {mode === 'assess' && (
            <Assessment
              withSession={withSession}
              onCancel={() => setMode('chat')}
              onDone={(d) => { setResult(d); setMode('done') }}
            />
          )}
          {mode === 'done' && result && (
            <ReferenceResult
              result={result}
              onBack={() => { setMode('chat'); setMsgs((m) => [...m, { from: 'bot', text: `Your summary is saved. Your reference code is ${result.reference_code}. Please go to the center as soon as possible.` }]) }}
            />
          )}

          {mode === 'chat' && (
            <div className="chat" aria-label="Clinic information chat">
              <div className="chat-log" role="log" aria-live="polite">
                {msgs.map((m, i) => (
                  <div key={i}>
                    <div className={`bubble bubble-${m.from}`} style={{ whiteSpace: 'pre-line' }}>{m.text}</div>
                    {m.assess && (
                      <button type="button" className="btn btn-primary cf-assess-btn" onClick={startAssessment}>
                        Answer a few questions for the clinic
                      </button>
                    )}
                  </div>
                ))}
                {busy && <div className="bubble bubble-bot">{slow ? 'The assistant is waking up. The first answer can take up to a minute…' : 'Typing...'}</div>}
                <div ref={end} />
              </div>
              <div className="chat-quick">
                {QUICK.map((q) => (
                  <button key={q} type="button" className="chip" disabled={busy} onClick={() => send(q)}>{q}</button>
                ))}
                <button type="button" className="chip" disabled={busy} onClick={startAssessment}>I was bitten or scratched</button>
              </div>
              <form className="chat-form" onSubmit={(e) => { e.preventDefault(); send(input) }}>
                <label htmlFor="chat-input" className="sr-only">Type your question</label>
                <input id="chat-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type your question" autoComplete="off" maxLength={500} />
                <button type="submit" className="btn btn-primary" disabled={busy} aria-label="Send message">
                  <Send size={18} strokeWidth={1.75} aria-hidden="true" /> Send
                </button>
              </form>
            </div>
          )}

          <p className="fineprint">
            <MessageCircle size={14} strokeWidth={1.75} aria-hidden="true" className="inline-icon" />
            {offline
              ? 'The clinic system is not reachable, so preset answers are used and nothing is saved. '
              : aiDown
                ? 'The AI assistant is unavailable, so preset answers are being used. '
                : 'Answers come from an AI that recognizes your question and replies with approved text. '}
            It is not staffed live and does not replace medical care. <Link to="/privacy">Privacy Notice</Link>
            {mode === 'chat' && (
              <> · <button type="button" className="cf-link" onClick={() => setMode('retrieve')}>View my saved summary</button></>
            )}
          </p>
        </div>
      </section>
    </>
  )
}