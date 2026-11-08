import { Phone, MessageSquare, Mail, Facebook } from 'lucide-react'
import { CLINIC, FACEBOOK_URL } from '../config'
import Reveal from './Reveal'

const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)

export default function ContactCards() {
  const emailHref = isMobile ? CLINIC.emailLink : CLINIC.gmailLink
  const emailProps = isMobile ? {} : { target: '_blank', rel: 'noreferrer' }

  return (
    <div className="grid-3">
      <Reveal className="card contact-card">
        <span className="icon-wrap"><Phone size={22} strokeWidth={1.75} aria-hidden="true" /></span>
        <h3>Call the Clinic</h3>
        <p className="muted">Call or text the clinic during operating hours.</p>
        <div className="btn-row">
          <a className="btn btn-primary" href={CLINIC.phoneLink}>
            <Phone size={16} strokeWidth={1.75} aria-hidden="true" /> {CLINIC.phoneDisplay}
          </a>
          <a className="btn btn-outline" href={CLINIC.smsLink}>
            <MessageSquare size={16} strokeWidth={1.75} aria-hidden="true" /> Text
          </a>
        </div>
      </Reveal>

      <Reveal className="card contact-card" delay={80}>
        <span className="icon-wrap"><Mail size={22} strokeWidth={1.75} aria-hidden="true" /></span>
        <h3>Email the Clinic</h3>
        <p className="muted">Send your question and include a phone number so staff can reply.</p>
        <a className="btn btn-outline break" href={emailHref} {...emailProps}>{CLINIC.email}</a>
      </Reveal>

      <Reveal className="card contact-card" delay={160}>
        <span className="icon-wrap"><Facebook size={22} strokeWidth={1.75} aria-hidden="true" /></span>
        <h3>Visit Our Facebook Page</h3>
        <p className="muted">Find updates and announcements from the clinic.</p>
        <a className="btn btn-outline" href={FACEBOOK_URL} target="_blank" rel="noreferrer">
          {CLINIC.facebookName}
        </a>
      </Reveal>
    </div>
  )
}