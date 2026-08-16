import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Binoculars, BookOpen, CalendarDays, CheckCircle2,
  ExternalLink, MapPin, Search, ShieldAlert, ShieldCheck, Sprout, Vote,
} from 'lucide-react'
import GuideHeader from './components/GuideHeader'
import { speciesBySlug, speciesGuides } from './content/species.generated'
import { useGuideRequests, useGuideSummaries } from './hooks/useGuide'
import { applyGuideMetadata } from './lib/guideSeo'

const EDIBLE_GROUP = new Set(['choice', 'edible'])
const HAZARD_GROUP = new Set(['poisonous', 'deadly'])
const CAUTION_GROUP = new Set(['caution'])

function formatDate(value) {
  if (!value) return 'No dated observation'
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function observationImage(url) {
  return url?.replace(/\/(square|small|thumb)\./, '/medium.')
}

function edibilityLabel(value) {
  if (value === 'choice') return 'Choice edible'
  if (value === 'caution') return 'Edible with caution'
  if (value === 'inedible') return 'Not a food mushroom'
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function GuideFooter() {
  return (
    <footer className="learn-footer">
      <div><strong>Mushroom Forage Map</strong><span>Observation is not identification.</span></div>
      <nav aria-label="Guide information">
        <a href="/learn/safety">Safety</a>
        <a href="/about">Editorial standards</a>
        <a href="/disclaimer">Disclaimer</a>
        <a href="/field-guide">How the map works</a>
      </nav>
    </footer>
  )
}

function GuideLayout({ children }) {
  return (
    <div className="learn-shell">
      <GuideHeader />
      {children}
      <GuideFooter />
    </div>
  )
}

function SpeciesCard({ species, summary }) {
  return (
    <article className="guide-species-card">
      <a className="species-card-image" href={`/learn/species/${species.slug}`} tabIndex="-1" aria-hidden="true">
        <img src={species.image.url} alt="" loading="lazy" />
      </a>
      <div className="species-card-copy">
        <div className="species-card-badges">
          <span className={`edibility-badge ${species.edibility}`}>{edibilityLabel(species.edibility)}</span>
          {summary && <span className="observation-badge"><MapPin size={12} aria-hidden="true" /> {summary.recent_observations} recent</span>}
        </div>
        <h2><a href={`/learn/species/${species.slug}`}>{species.common_name}</a></h2>
        <p className="latin-name">{species.latin_name}</p>
        <p>{species.summary}</p>
        <a className="species-card-link" href={`/learn/species/${species.slug}`}>Study field marks <ArrowRight size={15} aria-hidden="true" /></a>
      </div>
    </article>
  )
}

function GuideRequestPoll() {
  const { data, isError, refetch, vote } = useGuideRequests()
  const [choice, setChoice] = useState('')
  const selectedChoice = choice || data?.selection || ''
  const highestVotes = Math.max(1, ...(data?.options.map(option => option.votes) ?? [1]))

  function submitVote(event) {
    event.preventDefault()
    if (selectedChoice) vote.mutate(selectedChoice)
  }

  return (
    <section className="guide-request-poll" aria-labelledby="guide-request-title">
      <div className="guide-request-inner">
        <div className="guide-request-intro">
          <Vote size={24} aria-hidden="true" />
          <p className="eyebrow">Shape the next release</p>
          <h2 id="guide-request-title">Choose the next mushroom guide</h2>
          <p>Vote without an account. Your browser gets one anonymous vote, and you can change it whenever another species matters more.</p>
          <div className="guide-vote-total" aria-live="polite">
            <strong>{data?.total_votes ?? 0}</strong>
            <span>community {data?.total_votes === 1 ? 'vote' : 'votes'}</span>
          </div>
        </div>

        <div className="guide-request-ballot">
          {!data && !isError && (
            <div className="poll-skeleton" aria-label="Loading guide requests">
              {Array.from({ length: 6 }, (_, index) => <span key={index} />)}
            </div>
          )}
          {isError && (
            <div className="poll-error" role="alert">
              <p>Voting is temporarily unavailable.</p>
              <button className="button button-secondary" type="button" onClick={() => refetch()}>Try voting again</button>
            </div>
          )}
          {data && (
            <form onSubmit={submitVote}>
              <fieldset disabled={vote.isPending}>
                <legend className="sr-only">Mushroom guide candidates</legend>
                <div className="poll-options">
                  {data.options.map(option => (
                    <label key={option.slug} className={`poll-option ${selectedChoice === option.slug ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="guide-request"
                        value={option.slug}
                        checked={selectedChoice === option.slug}
                        onChange={() => setChoice(option.slug)}
                      />
                      <span className="poll-option-copy">
                        <strong>{option.common_name}</strong>
                        <em>{option.latin_name}</em>
                        <small>{option.reason}</small>
                      </span>
                      <span className="poll-option-count">{option.votes}</span>
                      <span className="poll-option-bar" style={{ '--vote-share': `${(option.votes / highestVotes) * 100}%` }} aria-hidden="true" />
                    </label>
                  ))}
                </div>
              </fieldset>
              {vote.isError && <p className="form-error" role="alert">Your vote could not be saved. Please try again.</p>}
              <div className="poll-submit-row">
                <button className="button button-primary" type="submit" disabled={!selectedChoice || vote.isPending}>
                  <Vote size={16} aria-hidden="true" />
                  {vote.isPending ? 'Saving vote...' : data.selection ? 'Update vote' : 'Cast vote'}
                </button>
                {data.selection && !vote.isPending && <p>Your vote is recorded. Results update immediately.</p>}
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}

function GuideHome({ summaries }) {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('all')
  const summaryByTaxon = useMemo(
    () => Object.fromEntries(summaries.map(item => [item.inaturalist_taxon_id, item])),
    [summaries],
  )
  const visibleSpecies = speciesGuides.filter(species => {
    const textMatch = `${species.common_name} ${species.latin_name} ${species.habitat}`.toLowerCase().includes(query.trim().toLowerCase())
    if (!textMatch) return false
    if (group === 'edible') return EDIBLE_GROUP.has(species.edibility)
    if (group === 'hazard') return HAZARD_GROUP.has(species.edibility)
    return true
  })

  return (
    <GuideLayout>
      <main className="learn-main">
        <section className="learn-hero">
          <img src={speciesBySlug.morel.image.url} alt="Morel mushroom among spring leaf litter" />
          <div className="learn-hero-overlay" />
          <div className="learn-hero-content">
            <p className="eyebrow"><BookOpen size={16} aria-hidden="true" /> Mushroom identification guide</p>
            <h1>Learn the mushroom in front of you</h1>
            <p>Field marks, dangerous lookalike checks, cited safety notes, and recent reviewed observations for the map's current species.</p>
            <div className="hero-actions">
              <a className="button button-primary" href="#browse-species"><Binoculars size={17} aria-hidden="true" /> Browse {speciesGuides.length} species</a>
              <a className="button button-inverse" href="/learn/safety"><ShieldAlert size={17} aria-hidden="true" /> Safety rules</a>
            </div>
          </div>
          <a className="hero-photo-credit" href={speciesBySlug.morel.image.source} target="_blank" rel="noreferrer">Photo: {speciesBySlug.morel.image.credit}</a>
        </section>

        <section className="guide-principles" aria-label="Guide standards">
          <div><CheckCircle2 size={19} aria-hidden="true" /><span><strong>Multiple field marks</strong>Never one photo alone</span></div>
          <div><ShieldCheck size={19} aria-hidden="true" /><span><strong>Lookalikes first</strong>Danger is shown in context</span></div>
          <div><Sprout size={19} aria-hidden="true" /><span><strong>Live evidence</strong>Recent reviewed observations</span></div>
        </section>

        <section className="species-browser" id="browse-species">
          <div className="species-browser-heading">
            <div><p className="eyebrow">Current catalogue</p><h2>Browse mushroom guides</h2></div>
            <p>These pages teach what to examine. They cannot confirm edibility.</p>
          </div>
          <div className="guide-search-row">
            <label className="guide-search">
              <Search size={18} aria-hidden="true" />
              <span className="sr-only">Search mushroom guides</span>
              <input type="search" placeholder="Search name or habitat" value={query} onChange={event => setQuery(event.target.value)} />
            </label>
            <div className="guide-group-filter" role="group" aria-label="Guide species group">
              <button className={group === 'all' ? 'active' : ''} type="button" aria-pressed={group === 'all'} onClick={() => setGroup('all')}>All</button>
              <button className={group === 'edible' ? 'active' : ''} type="button" aria-pressed={group === 'edible'} onClick={() => setGroup('edible')}>Edible-listed</button>
              <button className={group === 'hazard' ? 'active hazard' : ''} type="button" aria-pressed={group === 'hazard'} onClick={() => setGroup('hazard')}>Toxic</button>
            </div>
          </div>
          <div className="guide-species-grid">
            {visibleSpecies.map(species => <SpeciesCard key={species.slug} species={species} summary={summaryByTaxon[species.taxon_id]} />)}
          </div>
          {visibleSpecies.length === 0 && <p className="guide-empty">No guide matches that search.</p>}
        </section>

        <section className="guide-safety-band">
          <ShieldAlert size={26} aria-hidden="true" />
          <div><h2>Identification is a process, not a picture match</h2><p>Confirm cap, underside, stem, base, interior, spore print, substrate, and habitat. Use multiple reputable sources and a qualified local expert before considering consumption.</p></div>
          <a className="button button-secondary" href="/learn/safety">Read safety rules <ArrowRight size={16} aria-hidden="true" /></a>
        </section>
        <GuideRequestPoll />
      </main>
    </GuideLayout>
  )
}

function LookalikeCards({ lookalikes }) {
  return (
    <section className="lookalike-section" aria-labelledby="lookalike-title">
      <div className="section-kicker"><ShieldAlert size={18} aria-hidden="true" /><span>Compare before concluding</span></div>
      <h2 id="lookalike-title">Lookalikes to rule out</h2>
      <div className="lookalike-grid">
        {lookalikes.map(item => (
          <article key={item.name} className={`lookalike-card severity-${item.severity}`}>
            <div><h3>{item.slug ? <a href={`/learn/species/${item.slug}`}>{item.name}</a> : item.name}</h3><span>{item.severity.replace('-', ' ')}</span></div>
            <p>{item.check}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function LiveFieldSignal({ species, summary }) {
  return (
    <aside className="live-field-signal" aria-labelledby="live-signal-title">
      <div className="live-signal-heading"><MapPin size={18} aria-hidden="true" /><div><h2 id="live-signal-title">Live field signal</h2><p>Reviewed observations from the past 90 days</p></div></div>
      {summary ? (
        <>
          {summary.latest_photo_url && (
            <figure>
              <img src={observationImage(summary.latest_photo_url)} alt={`Recent ${species.common_name} observation`} loading="lazy" />
              <figcaption>
                {summary.latest_photo_attribution || 'Recent public observation'}
                {summary.latest_source_url && <> / <a href={summary.latest_source_url} target="_blank" rel="noreferrer">source <ExternalLink size={11} aria-hidden="true" /></a></>}
              </figcaption>
            </figure>
          )}
          <dl>
            <div><dt>Recent finds</dt><dd>{summary.recent_observations.toLocaleString()}</dd></div>
            <div><dt>Last observed</dt><dd>{formatDate(summary.latest_observed_on)}</dd></div>
          </dl>
        </>
      ) : <p className="live-signal-loading">Loading current field evidence...</p>}
      <a className="button button-primary" href={`/?taxon=${species.taxon_id}`}><MapPin size={16} aria-hidden="true" /> Show on map</a>
      <p className="live-signal-note">Location pins are approximate where privacy protection applies.</p>
    </aside>
  )
}

function SpeciesPage({ species, summary }) {
  return (
    <GuideLayout>
      <main className="species-guide-main">
        <nav className="guide-breadcrumbs" aria-label="Breadcrumb">
          <a href="/learn">Mushroom guide</a><span>/</span><span aria-current="page">{species.common_name}</span>
        </nav>

        <header className="species-hero">
          <img src={species.image.url} alt={species.image.alt} />
          <div className="species-hero-overlay" />
          <div className="species-hero-copy">
            <div className="species-hero-badges"><span className={`edibility-badge ${species.edibility}`}>{edibilityLabel(species.edibility)}</span><span className="difficulty-badge">{species.difficulty}</span></div>
            <h1>{species.common_name}</h1>
            <p className="species-latin">{species.latin_name}{species.aliases ? ` / ${species.aliases}` : ''}</p>
            <p>{species.summary}</p>
          </div>
          <a className="hero-photo-credit" href={species.image.source} target="_blank" rel="noreferrer">Photo: {species.image.credit}</a>
        </header>

        <div className="species-review-line">
          <span>Compiled by <strong>{species.author}</strong></span>
          <span>{species.reviewer}</span>
          <span>Last reviewed <time dateTime={species.last_reviewed}>{formatDate(species.last_reviewed)}</time></span>
        </div>

        <section className={`species-warning ${HAZARD_GROUP.has(species.edibility) ? 'danger' : ''}`}>
          <ShieldAlert size={22} aria-hidden="true" /><div><strong>{HAZARD_GROUP.has(species.edibility) || CAUTION_GROUP.has(species.edibility) ? 'Toxicity warning' : 'Identification warning'}</strong><p>{species.warning}</p></div>
        </section>

        <dl className="species-quick-facts">
          <div><dt><CalendarDays size={16} aria-hidden="true" /> Season</dt><dd>{species.season}</dd></div>
          <div><dt><Sprout size={16} aria-hidden="true" /> Habitat</dt><dd>{species.habitat}</dd></div>
          <div><dt><Binoculars size={16} aria-hidden="true" /> Underside</dt><dd>{species.underside}</dd></div>
          <div><dt><ShieldCheck size={16} aria-hidden="true" /> Spore evidence</dt><dd>{species.spore_print}</dd></div>
        </dl>

        <div className="species-guide-layout">
          <article className="species-guide-content">
            <LookalikeCards lookalikes={species.lookalikes} />
            <div className="guide-markdown" dangerouslySetInnerHTML={{ __html: species.content_html }} />
          </article>
          <LiveFieldSignal species={species} summary={summary} />
        </div>

        <section className="species-safety-footer">
          <ShieldAlert size={24} aria-hidden="true" />
          <div><h2>Never eat a mushroom from this page alone</h2><p>Reach 100% certainty using the whole specimen, multiple reputable sources, and a qualified local expert. Cook all wild mushrooms, try a small amount of one new species, and keep an uncooked specimen.</p></div>
          <a href="/learn/safety">Safety and poison response <ArrowRight size={16} aria-hidden="true" /></a>
        </section>

        <a className="back-to-guide" href="/learn"><ArrowLeft size={16} aria-hidden="true" /> Back to all mushroom guides</a>
      </main>
    </GuideLayout>
  )
}

function SafetyPage() {
  const rules = [
    ['Use the whole specimen', 'Check the cap, underside, stem, base, interior, spore print, substrate, habitat, and local range.'],
    ['Learn deadly patterns first', 'White gills, a white spore print, a ring, and a sack-like volva are an Amanita warning. Skip little brown mushrooms as a beginner.'],
    ['Cooking is not detoxification', 'Cook known edible mushrooms, but remember that heat does not neutralize amatoxins and may not remove other toxins.'],
    ['One new species at a time', 'Try a small cooked amount, avoid alcohol with a first trial, and keep an uncooked specimen refrigerated in a paper bag.'],
    ['Folklore tests do not work', 'Animals, silver spoons, smell, peeling skin, and photo-ID apps cannot establish edibility.'],
  ]
  return (
    <GuideLayout>
      <main className="trust-page safety-page">
        <p className="eyebrow"><ShieldAlert size={16} aria-hidden="true" /> Field safety</p>
        <h1>Wild mushroom safety and poison response</h1>
        <p className="trust-lede">A delayed reaction can still be life threatening. When a dangerous ingestion is possible, call for help before symptoms begin.</p>
        <section className="poison-response">
          <div><span>United States Poison Control</span><a href="tel:18002221222">1-800-222-1222</a><small>Free, confidential, 24/7</small></div>
          <div><h2>Save the evidence</h2><p>Keep whole mushrooms, including the dug-up base, or meal leftovers in paper or wax paper and refrigerate them. Photograph the cap, underside, stem, base, and habitat.</p></div>
          <div><h2>Do not trust false recovery</h2><p>Amatoxin and gyromitrin symptoms can wait 6 to 24 hours. Feeling better after severe gastrointestinal illness does not mean the danger has passed.</p></div>
        </section>
        <section className="safety-rules"><h2>Non-negotiable beginner rules</h2>{rules.map(([title, copy], index) => <article key={title}><span>{index + 1}</span><div><h3>{title}</h3><p>{copy}</p></div></article>)}</section>
        <p className="global-safety-note">Outside the United States, contact your local poison center or emergency service. For expert mushroom support during an incident, see <a href="https://namyco.org/interests/toxicology/report-a-poisoning/" target="_blank" rel="noreferrer">NAMA's poisoning resources <ExternalLink size={13} aria-hidden="true" /></a>.</p>
      </main>
    </GuideLayout>
  )
}

function AboutPage() {
  return (
    <GuideLayout>
      <main className="trust-page">
        <p className="eyebrow"><ShieldCheck size={16} aria-hidden="true" /> Editorial standards</p>
        <h1>Field evidence, clearly separated from identification</h1>
        <p className="trust-lede">Mushroom Forage Map is a public observation map and educational reference. It is not an identification service, an access permit, or an edibility guarantee.</p>
        <section className="trust-sections">
          <article><h2>What reviewed means</h2><p>Public observations have passed source or community review and use privacy-safe coordinates. Review supports data quality; it does not certify the mushroom in a visitor's hand.</p></article>
          <article><h2>How guide content is handled</h2><p>Species content lives as Markdown in the public repository, so changes are versioned and reviewable. Pages name their compiler, review status, date, and sources. Until a qualified expert signs off, they say that review is pending.</p></article>
          <article><h2>What we cite</h2><p>Safety and medical claims prioritize poison centers, government agencies, university resources, toxicology literature, and established mycological organizations. Observation photography is licensed and attributed.</p></article>
          <article><h2>How locations are protected</h2><p>Approximate public coordinates are shifted before publication. Exact contributor coordinates remain private unless the contributor explicitly chooses otherwise.</p></article>
        </section>
        <a className="button button-primary" href="/learn">Open the mushroom guide <ArrowRight size={16} aria-hidden="true" /></a>
      </main>
    </GuideLayout>
  )
}

function DisclaimerPage() {
  return (
    <GuideLayout>
      <main className="trust-page disclaimer-page">
        <p className="eyebrow"><ShieldAlert size={16} aria-hidden="true" /> Important limits</p>
        <h1>Identification and foraging disclaimer</h1>
        <p className="trust-lede">Do not eat, handle, collect, or travel to a mushroom based only on this website.</p>
        <section className="trust-sections">
          <article><h2>Educational reference only</h2><p>Descriptions, photos, edibility labels, observation dates, and map markers are educational information. They cannot account for every regional species, individual variation, contamination, allergy, preparation risk, or changing scientific conclusion.</p></article>
          <article><h2>No access permission</h2><p>A marker does not grant access or permission to collect. Verify land ownership, current closures, permits, harvest limits, protected species, and local regulations with the responsible authority.</p></article>
          <article><h2>Use qualified local help</h2><p>Identification should use the complete specimen, multiple independent expert sources, and a qualified person familiar with mushrooms in the region. No photograph, app, or algorithm can confirm edibility.</p></article>
          <article><h2>Suspected poisoning</h2><p>Contact a poison center or emergency service immediately. Do not wait for symptoms and do not use this website to diagnose or treat an exposure.</p></article>
        </section>
        <a className="button button-primary" href="/learn/safety">Read poison-response steps <ArrowRight size={16} aria-hidden="true" /></a>
      </main>
    </GuideLayout>
  )
}

function NotFoundPage() {
  return <GuideLayout><main className="guide-not-found"><h1>Guide page not found</h1><p>The species may not be in the current catalogue.</p><a className="button button-primary" href="/learn">Browse the guide</a></main></GuideLayout>
}

export default function GuideApp({ path = '/learn' }) {
  const normalizedPath = path.length > 1 ? path.replace(/\/$/, '') : path
  const { data: summaries = [] } = useGuideSummaries()

  useEffect(() => applyGuideMetadata(normalizedPath), [normalizedPath])

  if (normalizedPath === '/learn') return <GuideHome summaries={summaries} />
  if (normalizedPath === '/learn/safety') return <SafetyPage />
  if (normalizedPath === '/about') return <AboutPage />
  if (normalizedPath === '/disclaimer') return <DisclaimerPage />

  const speciesMatch = normalizedPath.match(/^\/learn\/species\/([^/]+)$/)
  if (speciesMatch) {
    const species = speciesBySlug[speciesMatch[1]]
    if (species) return <SpeciesPage species={species} summary={summaries.find(item => item.inaturalist_taxon_id === species.taxon_id)} />
  }
  return <NotFoundPage />
}
