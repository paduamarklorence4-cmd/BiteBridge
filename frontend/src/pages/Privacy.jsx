import { Link } from 'react-router-dom'
import { CLINIC } from '../config'
import { CHAT_PATH } from '../chatUrl'
import PageHeader from './PageHeader'

// DRAFT text. Have the center and your adviser review it before real use.
export default function Privacy() {
  return (
    <>
      <PageHeader title="Privacy Notice" text="How EZ Animal Bite Center handles information shared through this website." />
      <section className="section">
        <div className="container narrow">
          <div className="card">
            <h2>What may be collected</h2>
            <p>
              You can use the chat without giving your name. If you choose to continue, the chat may ask for your name,
              contact number, details about the bite or scratch, and an optional photo of the wound. Your chat messages
              are also saved so the center can review them.
            </p>

            <h2>Why it is collected</h2>
            <p>
              To give basic first aid information, to help our nurse or physician prepare for your visit, and, if you
              provide a contact number, to send vaccination reminders.
            </p>

            <h2>Who can see it</h2>
            <p>
              Only authorized center staff can see the information you provide. It is not shown publicly. A reference
              code lets you view your own saved first aid summary again.
            </p>

            <h2>Important</h2>
            <p>
              The chat gives general information only. It does not diagnose, prescribe, or replace assessment and
              treatment by a nurse or physician. Any exposure category shown to staff is only a preliminary suggestion
              until staff confirm it.
            </p>

            <h2>Your choices</h2>
            <p>
              You may stop at any time and choose not to provide your name or number. To ask about or correct your
              information, call the center at {CLINIC.phoneDisplay} during operating hours.
            </p>

            <p>
              <Link to={CHAT_PATH} className="btn btn-primary">Back to chat</Link>
            </p>
          </div>
        </div>
      </section>
    </>
  )
}