import { Link } from 'react-router-dom'
import {
  Phone, Navigation, BookOpen, MapPin, TriangleAlert,
} from 'lucide-react'
import { CLINIC } from '../config'
import Reveal from '../components/Reveal'
import OpenStatus from '../components/OpenStatus'
import ContactCards from '../components/ContactCards'
import ServiceGrid from '../components/ServiceGrid'
import StageBackground from '../components/StageBackground'

export default function Home() {
  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-bg" role="img" aria-label="The front of EZ Animal Bite Center in Calapan City" />
        <div className="hero-overlay" />
        <div className="container hero-content">
          <p className="hero-kicker">{CLINIC.name} · Calapan City</p>
          <h1 id="hero-title" className="hero-title">Your Safety Starts with the Right Care.</h1>
          <p className="hero-text">
            Learn about animal bite first aid, explore available clinic services, and find the
            information you need to take the next step toward appropriate medical care.
          </p>
          <div className="hero-actions">
            <Link to="/first-aid" className="btn btn-primary btn-lg">
              <BookOpen size={18} strokeWidth={1.75} aria-hidden="true" /> First Aid Guide
            </Link>
            <a href={CLINIC.mapsUrl} target="_blank" rel="noreferrer" className="btn btn-light btn-lg">
              <Navigation size={18} strokeWidth={1.75} aria-hidden="true" /> Get Directions
            </a>
            <Link to="/contact" className="btn btn-ghost btn-lg">Contact Us</Link>
          </div>
          <div className="hero-status"><OpenStatus /></div>
        </div>
      </section>

      <div className="home-stage">
        <StageBackground />

        <section className="section">
          <div className="container">
            <Reveal className="section-head" dir="left">
              <h2>How we can help</h2>
              <p className="muted">
                Contact the clinic to ask about these services and what to bring to your visit.
              </p>
            </Reveal>
            <ServiceGrid />
            <p className="fineprint">Please confirm availability with the clinic before your visit.</p>
          </div>
        </section>

        <section className="section" aria-labelledby="emergency-title">
          <div className="container">
            <Reveal className="emergency" dir="zoom">
              <div className="emergency-icon"><TriangleAlert size={28} strokeWidth={1.75} aria-hidden="true" /></div>
              <div className="emergency-body">
                <h2 id="emergency-title" className="emergency-title">EMERGENCY INFORMATION</h2>
                <p>
                  Seek prompt professional medical assessment after any animal bite or scratch, even if
                  the wound looks small. Wash the wound right away while you arrange to be seen.
                </p>
                <p className="emergency-hours">
                  Clinic hours: Monday–Saturday 8:00 AM–5:00 PM · Sunday 8:00 AM–12:00 NN. This number is
                  answered during operating hours only.
                </p>
              </div>
              <a href={CLINIC.phoneLink} className="btn btn-danger btn-lg">
                <Phone size={18} strokeWidth={1.75} aria-hidden="true" /> {CLINIC.phoneDisplay}
              </a>
            </Reveal>
          </div>
        </section>

        <section className="section">
          <div className="container split">
            <Reveal dir="left">
              <h2>Find Our Clinic</h2>
              <p className="lead">
                <MapPin size={18} strokeWidth={1.75} aria-hidden="true" className="inline-icon" />
                {CLINIC.address}
              </p>
              <p className="muted">
                Open Monday–Saturday 8:00 AM–5:00 PM and Sunday 8:00 AM–12:00 NN.
              </p>
              <a href={CLINIC.mapsUrl} target="_blank" rel="noreferrer" className="btn btn-primary">
                <Navigation size={18} strokeWidth={1.75} aria-hidden="true" /> Get Directions
              </a>
              <div className="map-frame home-map">
                <iframe
                  title={`Map showing ${CLINIC.name}`}
                  src={CLINIC.mapsEmbed}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </Reveal>
            <Reveal dir="right" delay={150}>
              <ContactCards />
            </Reveal>
          </div>
        </section>
      </div>
    </>
  )
}