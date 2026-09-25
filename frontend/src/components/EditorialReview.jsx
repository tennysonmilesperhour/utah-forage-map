import reviews from '../data/editorialReviews.json'
import entries from '../data/editorialCoverage.json'

export function EditorialReview({ collection, slug }) {
  const review = reviews[`${collection}:${slug}`]
  return <aside className="editorial-review"><strong>{review ? 'Independent review recorded' : 'Independent specialist review pending'}</strong><p>{review ? <>{review.reviewer} · {review.credentials} · <time dateTime={review.date}>{review.date}</time>. Scope: {review.scope}. <a href={review.evidence}>Review record</a>.</> : 'Source checking is not expert field review. This page cannot identify a specimen or establish that it is safe to gather.'} <a href="/about#review-queue">Review coverage and priorities</a></p></aside>
}

export function ReviewQueue() {

  return <section id="review-queue" className="review-queue"><h2>Specialist review coverage</h2><p>{entries.filter(p => reviews[p.key]).length} of {entries.length} profiles have a recorded independent review. First priority: toxic species, consequential preparation claims and dangerous edible lookalikes. Review dates will name the reviewer, qualifications, regional scope and signed review record.</p><details><summary>View the profile review queue</summary><ul>{entries.map(p => <li key={p.key}><a href={p.href}>{p.name}</a> — {reviews[p.key] ? `review recorded ${reviews[p.key].date}` : 'pending'}{p.priority === 0 ? ' · safety priority' : ''}</li>)}</ul></details><p>Regional expansion needs local expertise, diagnostic photographs across life stages, native and introduced status, and current conservation and access sources. The current collection is a starting point. <a href="mailto:morphiclabsdata@gmail.com?subject=Specialist%20review%20contribution">Contribute a review or correction</a>.</p></section>
}
