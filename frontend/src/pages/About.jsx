import { Link } from 'react-router-dom'
import { CLINIC } from '../config'
import PageHeader from './PageHeader'
import Reveal from '../components/Reveal'
import HoursTable from '../components/HoursTable'

export default function About() {
  return (
    <>
      <PageHeader
        title="About Us"
        text={`${CLINIC.name} is located in Calapan City and focuses on animal bite care and information.`}
      />
      <section className="section">
        <div className="container split">
          <Reveal>
            <h2>Our focus</h2>
            <p>
              Animal bites and scratches can be frightening, and knowing what to do first matters.
              This website gives you plain-language first aid information and shows you how to reach
              the clinic.
            </p>
            <p>
              The information here is general guidance. It does not replace an assessment by a
              healthcare professional. If you or someone else has been bitten or scratched, contact
              the clinic or seek medical care promptly.
            </p>
            <div className="btn-row">
              <Link to="/first-aid" className="btn btn-primary">Read the First Aid Guide</Link>
              <Link to="/contact" className="btn btn-outline">Contact Us</Link>
            </div>
          </Reveal>
          <Reveal delay={100}><HoursTable /></Reveal>
        </div>
      </section>
    </>
  )
}
