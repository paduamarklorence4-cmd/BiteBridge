import { Link } from 'react-router-dom'
import { Phone, Mail, MapPin, Clock, Facebook } from 'lucide-react'
import { CLINIC, FACEBOOK_URL } from '../config'

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <p className="footer-brand">{CLINIC.name}</p>
          <p className="footer-muted">
            General animal bite information and clinic details. This website does not provide
            diagnosis or treatment.
          </p>
        </div>

        <div>
          <p className="footer-head">Contact</p>
          <ul className="footer-list">
            <li>
              <Phone size={16} strokeWidth={1.75} aria-hidden="true" />
              <a href={CLINIC.phoneLink}>{CLINIC.phoneDisplay}</a>
            </li>
            <li>
              <Mail size={16} strokeWidth={1.75} aria-hidden="true" />
              <a href={CLINIC.emailLink}>{CLINIC.email}</a>
            </li>
            <li>
              <MapPin size={16} strokeWidth={1.75} aria-hidden="true" />
              <a href={CLINIC.mapsUrl} target="_blank" rel="noreferrer">
                {CLINIC.address}
              </a>
            </li>
            <li>
              <Facebook size={16} strokeWidth={1.75} aria-hidden="true" />
              {FACEBOOK_URL ? (
                <a href={FACEBOOK_URL} target="_blank" rel="noreferrer">
                  {CLINIC.facebookName}
                </a>
              ) : (
                <span>{CLINIC.facebookName}</span>
              )}
            </li>
          </ul>
        </div>

        <div>
          <p className="footer-head">Hours</p>
          <ul className="footer-list">
            <li>
              <Clock size={16} strokeWidth={1.75} aria-hidden="true" />
              <span>Monday–Saturday: 8:00 AM–5:00 PM</span>
            </li>
            <li>
              <Clock size={16} strokeWidth={1.75} aria-hidden="true" />
              <span>Sunday: 8:00 AM–12:00 NN</span>
            </li>
          </ul>
        </div>

        <div>
          <p className="footer-head">Explore</p>
          <ul className="footer-links">
            <li><Link to="/first-aid">First Aid Guide</Link></li>
            <li><Link to="/services">Services</Link></li>
            <li><Link to="/location">Find Our Clinic</Link></li>
            <li><Link to="/staff-login">Staff Login</Link></li>
          </ul>
        </div>
      </div>
      <div className="container footer-bottom">
        © {new Date().getFullYear()} {CLINIC.name}. All rights reserved.
      </div>
    </footer>
  )
}
