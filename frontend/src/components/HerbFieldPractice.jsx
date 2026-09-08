import { useEffect, useRef, useState } from 'react'
import { ArrowRight, BookHeart, X } from 'lucide-react'
import { feelingInvitations, natureInvitations } from '../data/herbWisdom'
import HerbWisdomSources from './HerbWisdomSources'

const STEPS = ['Arrive', 'Notice', 'Carry forward']

export default function HerbFieldPractice() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [feeling, setFeeling] = useState('')
  const [encounter, setEncounter] = useState('')
  const toggleRef = useRef(null)
  const headingRef = useRef(null)
  const inner = feelingInvitations.find(item => item.id === feeling)
  const outer = natureInvitations.find(item => item.id === encounter)

  useEffect(() => {
    if (open) headingRef.current?.focus()
  }, [open, step])

  function close() {
    setOpen(false)
    setStep(0)
    setFeeling('')
    setEncounter('')
    toggleRef.current?.focus()
  }

  return (
    <section className="herb-field-practice" aria-labelledby="field-practice-title">
      <div className="field-practice-heading">
        <div><p className="herb-kicker"><BookHeart size={16} aria-hidden="true" /> Inner weather · living world</p><h2 id="field-practice-title">A moment before you gather.</h2><p>Bring what you are feeling. Notice who else is here. Let the visit shape one small act of care.</p></div>
        <button ref={toggleRef} type="button" className="herb-outline-button" aria-expanded={open} aria-controls="field-practice-body" onClick={() => open ? close() : setOpen(true)}>{open ? <><X size={16} aria-hidden="true" /> Close practice</> : <>Begin a field pause <ArrowRight size={16} aria-hidden="true" /></>}</button>
      </div>
      <div id="field-practice-body" hidden={!open}>
        <p className="field-practice-permission">Every prompt is optional. You can reflect silently, skip a step, or stop whenever you wish. Your selections are not saved or sent to the server.</p>
        <nav className="field-practice-steps" aria-label="Field pause steps">
          {STEPS.map((label, index) => <button type="button" key={label} aria-current={step === index ? 'step' : undefined} onClick={() => setStep(index)}><span aria-hidden="true">0{index + 1}</span>{label}</button>)}
        </nav>
        <div className="field-practice-content">
          {step === 0 && <>
            <h3 ref={headingRef} tabIndex={-1}>How are you arriving?</h3>
            <fieldset className="field-practice-choices"><legend className="sr-only">Choose a feeling, if you wish</legend>{feelingInvitations.map(item => <label key={item.id}><input type="radio" name="field-feeling" value={item.id} checked={feeling === item.id} onChange={() => setFeeling(item.id)} /><span>{item.label}</span></label>)}</fieldset>
            <p className="field-practice-response" aria-live="polite">{inner?.invitation ?? 'A feeling can be acknowledged without being solved. Choose a word that fits, or continue without choosing.'}</p>
          </>}
          {step === 1 && <>
            <h3 ref={headingRef} tabIndex={-1}>What has your attention?</h3>
            <fieldset className="field-practice-choices"><legend className="sr-only">Choose what you noticed, if you wish</legend>{natureInvitations.map(item => <label key={item.id}><input type="radio" name="field-encounter" value={item.id} checked={encounter === item.id} onChange={() => setEncounter(item.id)} /><span>{item.label}</span></label>)}</fieldset>
            <div className="field-practice-response" aria-live="polite">{outer ? <><p>{outer.observe}</p><p>{outer.reflect}</p></> : <p>Begin with what you can observe. If an encounter feels meaningful, let that meaning be personal and open to change.</p>}</div>
          </>}
          {step === 2 && <>
            <h3 ref={headingRef} tabIndex={-1}>What will you carry into the day?</h3>
            <div className="field-practice-response"><p>{inner?.carry ?? 'I can give attention to this place and to what I need today.'}</p><p>{outer?.care ?? 'Leave room for the other lives using this place. A visit without gathering is a complete visit.'}</p></div>
            <p>Before gathering, return to plant identity, permission, and the condition of the patch. An intuition or animal encounter cannot tell you whether a plant is safe to use.</p>
          </>}
          <div className="field-practice-actions">
            {step > 0 && <button type="button" className="herb-text-button" onClick={() => setStep(step - 1)}>Back</button>}
            {step < 2 ? <button type="button" className="herb-solid-button" onClick={() => setStep(step + 1)}>{step === 0 ? 'Continue to noticing' : 'Carry it forward'}<ArrowRight size={16} aria-hidden="true" /></button> : <button type="button" className="herb-solid-button" onClick={close}>Finish this pause</button>}
          </div>
        </div>
      </div>
      <HerbWisdomSources />
    </section>
  )
}
