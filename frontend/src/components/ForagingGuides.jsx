import { ArrowRight, BookOpen } from 'lucide-react'
import { foragingGuides } from '../content/foraging.generated'

export function GuideContents({ headings }) {
  return <nav className="field-contents" aria-label="On this page"><strong>On this page</strong><ul>{headings.map(heading => <li key={heading.id}><a href={`#${heading.id}`}>{heading.text}</a></li>)}</ul></nav>
}

export function ForagingCards({ compact = false }) {
  const guides = compact ? foragingGuides.filter(guide => ['beginners', 'mushroom-season', 'wild-herb-gathering'].includes(guide.slug)) : foragingGuides
  return <div className="field-skills-grid">{guides.map(guide => <article key={guide.slug}><span className="eyebrow">{guide.category}</span><h2><a href={`/learn/foraging/${guide.slug}`}>{guide.title}</a></h2><p>{guide.summary}</p><a href={`/learn/foraging/${guide.slug}`} className="species-card-link">Read the guide <ArrowRight size={15} aria-hidden="true" /></a></article>)}</div>
}

export function ForagingIndex() {
  return <main className="field-skills-main"><header className="field-skills-heading"><p className="eyebrow"><BookOpen size={16} aria-hidden="true" /> Field skills</p><h1>Mushroom and wild herb foraging guides</h1><p>Start with identification, learn what seasonal records can tell you, and plan a responsible visit. These practical guides connect the mushroom map and plant atlas with primary references.</p></header><ForagingCards /><aside className="field-reference-note">Compiled by the Mushroom Forage Map field desk. Independent expert review is pending. These guides support field study and do not establish edibility or grant access to land. <a href="/about#editorial">Read our editorial standards.</a></aside></main>
}

export function ForagingArticle({ guide }) {
  return <main className="field-skills-main"><nav className="guide-breadcrumbs" aria-label="Breadcrumb"><a href="/learn">Mushroom guide</a><span>/</span><a href="/learn/foraging">Field skills</a><span>/</span><span aria-current="page">{guide.title}</span></nav><article><header className="field-skills-heading"><p className="eyebrow">{guide.category}</p><h1>{guide.title}</h1><p>{guide.summary}</p></header><div className="species-review-line"><span>Compiled by <a href="/about#editorial">{guide.author}</a></span><span>{guide.reviewer}</span><span>Updated <time dateTime={guide.updated}>{guide.updated}</time></span></div><div className="field-article-layout"><GuideContents headings={guide.headings} /><div><div className="guide-markdown" dangerouslySetInnerHTML={{ __html: guide.content_html }} /><section className="field-reference-note" id="reference-sources"><h2>Sources and corrections</h2><ul>{guide.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul><p>Sources support the guidance at the links cited; they have not reviewed or endorsed this website. <a href="/about#corrections">Report a correction</a>.</p></section></div></div></article><section className="field-next-steps"><h2>Continue your field study</h2><nav aria-label="Related field tools"><a href="/learn">Mushroom identification atlas</a><a href="/herbs/atlas">Wild plant atlas</a><a href="/regions">Regional mushroom records</a><a href="/learn/foraging">All field skills</a></nav></section></main>
}
