import { ArrowUpRight, BookOpen, CircleDot, Leaf, MoonStar, NotebookPen, Sprout, Stars } from 'lucide-react'
import {
  fieldJournalPrompts, gatheringSequence, lineageGuidance, moonCyclePractices,
  partWindows, skyWays, traditionShelf,
} from '../data/herbTraditions'

function SectionHeading({ icon, kicker, title, children }) {
  return <div className="practice-section-heading"><p className="herb-kicker">{icon}{kicker}</p><h2>{title}</h2>{children && <p>{children}</p>}</div>
}

export default function HerbalPracticeLibrary() {
  return (
    <main className="herbal-main practice-library-main">
      <section className="practice-hero">
        <div><p className="herb-kicker"><BookOpen size={16} /> Living lineages · personal practice</p><h1>Ways of gathering</h1></div>
        <div><p>Let season, sky, plant, place, and spirit speak together. These practices are offered as doorways—not as one universal tradition.</p><p className="practice-vow">Name the lineage. Honor the place. Take less. Return care.</p></div>
      </section>

      <section className="practice-section gathering-rite">
        <SectionHeading icon={<Leaf size={16} />} kicker="A complete field rite" title="From arrival to return">A spiritual harvest begins before the hand reaches out and continues after the material is home.</SectionHeading>
        <ol className="rite-steps">{gatheringSequence.map((step, index) => <li key={step.title}><span>{String(index + 1).padStart(2, '0')}</span><div><h3>{step.title}</h3><p>{step.body}</p><small>{step.practice}</small></div></li>)}</ol>
      </section>

      <section className="practice-section part-calendar">
        <SectionHeading icon={<Sprout size={16} />} kicker="The plant tells time" title="Harvest the part in its season">Calendar dates are approximate. Growth stage, scent, color, weather, abundance, and the plant’s life cycle give the closer answer.</SectionHeading>
        <div className="part-window-grid">{partWindows.map(item => <article key={item.part}><p>{item.season}</p><h3>{item.part}</h3><dl><div><dt>Readiness</dt><dd>{item.signs}</dd></div><div><dt>Daily window</dt><dd>{item.time}</dd></div><div><dt>Restraint</dt><dd>{item.counsel}</dd></div></dl></article>)}</div>
      </section>

      <section className="practice-section moon-round">
        <SectionHeading icon={<MoonStar size={16} />} kicker="Lunar practice" title="An eight-phase devotional round">This is a transparent synthesis of common European and Euro-American lunar-gardening themes, shaped into an optional contemplative practice. It is not presented as Indigenous teaching.</SectionHeading>
        <div className="moon-practice-grid">{moonCyclePractices.map((item, index) => <article key={item.phase}><span aria-hidden="true" className={`phase-mark phase-${index}`}><i /></span><div><p>{item.arc}</p><h3>{item.phase}</h3><p>{item.work}</p><small>{item.question}</small></div></article>)}</div>
      </section>

      <section className="practice-section sky-lineages">
        <SectionHeading icon={<Stars size={16} />} kicker="Moon, stars, and seasons" title="Different skies, different calendars">Celestial practice becomes meaningful through a named lineage and close knowledge of a particular place.</SectionHeading>
        <div className="sky-way-list">{skyWays.map(item => <article key={item.title}><CircleDot size={18} /><div><p>{item.lineage}</p><h3>{item.title}</h3><span>{item.body}</span></div></article>)}</div>
      </section>

      <section className="practice-section lineage-section">
        <SectionHeading icon={<Leaf size={16} />} kicker="Good relation" title="Carry teachings without flattening them" />
        <div className="lineage-guidance">{lineageGuidance.map(item => <article key={item.title}><h3>{item.title}</h3><p>{item.body}</p></article>)}</div>
      </section>

      <section className="practice-section journal-section">
        <SectionHeading icon={<NotebookPen size={16} />} kicker="Build a local calendar" title="A seven-question field record">Over repeated seasons, your journal becomes a conversation among inherited teaching, present ecology, and lived experience.</SectionHeading>
        <ol className="journal-prompts">{fieldJournalPrompts.map(prompt => <li key={prompt}>{prompt}</li>)}</ol>
      </section>

      <section className="practice-section reading-room">
        <SectionHeading icon={<BookOpen size={16} />} kicker="Reading room" title="Go to the named sources">Use these books to enter distinct teachings more deeply. Follow their attributions, cultural boundaries, and regional limits.</SectionHeading>
        <div className="tradition-shelf">{traditionShelf.map(item => <a href={item.url} target="_blank" rel="noreferrer" key={item.title}><ArrowUpRight size={18} /><h3>{item.title}</h3><p>{item.author}</p><small>{item.lineage}</small></a>)}</div>
      </section>
    </main>
  )
}
