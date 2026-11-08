import { MapPin } from 'lucide-react'
import { CLINIC } from '../config'
import PageHeader from './PageHeader'
import ContactCards from '../components/ContactCards'
import HoursTable from '../components/HoursTable'
import Reveal from '../components/Reveal'

export default function Contact() {
  return (
    <>
      <PageHeader title="Contact Us" text="Choose the way that is easiest for you." />
      <section className="section">
        <div className="container">
          <ContactCards />
          <div className="split spacer-top">
            <Reveal>
              <h2>Visit the clinic</h2>
              <p className="lead">
                <MapPin size={18} strokeWidth={1.75} aria-hidden="true" className="inline-icon" />
                {CLINIC.address}
              </p>
              <a href={CLINIC.mapsUrl} target="_blank" rel="noreferrer" className="btn btn-outline">
                Get Directions
              </a>
            </Reveal>
            <Reveal delay={100}><HoursTable /></Reveal>
          </div>
        </div>
      </section>
    </>
  )
}
