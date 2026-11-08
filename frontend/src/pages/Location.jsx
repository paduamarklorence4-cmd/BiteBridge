import { Navigation, MapPin } from 'lucide-react'
import { CLINIC } from '../config'
import PageHeader from './PageHeader'
import Reveal from '../components/Reveal'
import HoursTable from '../components/HoursTable'
import OpenStatus from '../components/OpenStatus'

export default function Location() {
  return (
    <>
      <PageHeader title="Find Our Clinic" text={CLINIC.address} />
      <section className="section">
        <div className="container split split-wide">
          <Reveal>
            <div className="map-frame">
              <iframe
                title={`Map showing ${CLINIC.name}`}
                src={CLINIC.mapsEmbed}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
            <p className="fineprint">
              If the map does not show the exact spot, use the Get Directions button to open Google Maps.
            </p>
          </Reveal>
          <Reveal delay={100}>
            <p className="lead">
              <MapPin size={18} strokeWidth={1.75} aria-hidden="true" className="inline-icon" />
              {CLINIC.address}
            </p>
            <p><OpenStatus /></p>
            <a href={CLINIC.mapsUrl} target="_blank" rel="noreferrer" className="btn btn-primary">
              <Navigation size={18} strokeWidth={1.75} aria-hidden="true" /> Get Directions
            </a>
            <div className="spacer" />
            <HoursTable />
          </Reveal>
        </div>
      </section>
    </>
  )
}
