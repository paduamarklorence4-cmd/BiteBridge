import { Link } from 'react-router-dom'
import { Phone, Navigation, TriangleAlert } from 'lucide-react'
import { CLINIC } from '../config'
import PageHeader from './PageHeader'
import Reveal from '../components/Reveal'

const STEPS = [
  {
    title: 'Move to safety',
    text: 'Step away from the animal so you are not bitten again. Do not try to catch or hurt it.',
  },
  {
    title: 'Wash the wound right away',
    text: 'Wash the bite or scratch with soap and running water for about 15 minutes. Do this even if the wound looks small.',
  },
  {
    title: 'Control any bleeding',
    text: 'Press a clean cloth or gauze gently on the wound. Do not scrub hard or squeeze the wound.',
  },
  {
    title: 'Cover the wound',
    text: 'After washing, cover it loosely with a clean, dry dressing. If you have an antiseptic such as povidone-iodine, you may apply it after washing.',
  },
  {
    title: 'Get a medical assessment promptly',
    text: 'A healthcare professional needs to assess every possible rabies exposure. Do not wait for symptoms to appear. Contact the clinic or go to the nearest health facility as soon as you can.',
  },
]

export default function FirstAid() {
  return (
    <>
      <PageHeader
        title="First Aid Guide"
        text="What to do in the first minutes after an animal bite or scratch."
      />
      <section className="section">
        <div className="container narrow">
          <Reveal className="notice">
            <TriangleAlert size={20} strokeWidth={1.75} aria-hidden="true" />
            <p>
              This page offers general first aid information only. It is not a diagnosis or a
              treatment plan and does not replace care from a healthcare professional.
            </p>
          </Reveal>

          <ol className="steps">
            {STEPS.map((s, i) => (
              <Reveal as="li" key={s.title} className="step" delay={i * 70}>
                <span className="step-num" aria-hidden="true">{i + 1}</span>
                <div>
                  <h2 className="step-title">{s.title}</h2>
                  <p>{s.text}</p>
                </div>
              </Reveal>
            ))}
          </ol>

          <Reveal>
            <h2>What to avoid</h2>
            <ul className="plain-list">
              <li>Do not apply herbs, oils, toothpaste, or other home remedies to the wound.</li>
              <li>Do not close or tightly bandage a bite wound yourself.</li>
              <li>Do not delay a medical assessment because the wound looks minor or has stopped bleeding.</li>
            </ul>
            <h2>Helpful details to share with staff</h2>
            <ul className="plain-list">
              <li>When and where the bite happened.</li>
              <li>The type of animal and whether it is a pet, a stray, or unknown.</li>
              <li>Whether the animal seemed unwell or acted unusually.</li>
              <li>Any previous vaccinations you or the animal have received, if known.</li>
            </ul>
          </Reveal>

          <Reveal className="cta-band">
            <div>
              <h2>Need to be seen?</h2>
              <p className="muted">Call during operating hours or get directions to the clinic.</p>
            </div>
            <div className="btn-row">
              <a href={CLINIC.phoneLink} className="btn btn-primary">
                <Phone size={18} strokeWidth={1.75} aria-hidden="true" /> Contact the Clinic
              </a>
              <a href={CLINIC.mapsUrl} target="_blank" rel="noreferrer" className="btn btn-outline">
                <Navigation size={18} strokeWidth={1.75} aria-hidden="true" /> Get Directions
              </a>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}
