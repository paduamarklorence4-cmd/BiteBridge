import { Link } from 'react-router-dom'
import PageHeader from './PageHeader'
import ServiceGrid from '../components/ServiceGrid'

export default function Services() {
  return (
    <>
      <PageHeader
        title="Services"
        text="A summary of what you can ask the clinic about. Please call to confirm availability."
      />
      <section className="section">
        <div className="container">
          <ServiceGrid />
          <p className="fineprint">
            Fees, schedules, and treatment plans are decided by the clinic. <Link to="/contact">Contact the clinic</Link> for details.
          </p>
        </div>
      </section>
    </>
  )
}
