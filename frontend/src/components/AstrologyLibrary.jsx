import { useState } from "react";
import { useCurrentUser } from "../hooks/useAuth";
import { useJournalQuery } from "../hooks/useJournal";
import {
  connections,
  planets,
  plantCorrespondences,
  signs,
  sources,
  systems,
} from "../data/astrology";
import { herbGuideBySlug } from "../data/herbGuide";
import "../journal.css";
function Source({ id }) {
  return (
    <a href={sources[id].url} target="_blank" rel="noreferrer">
      {sources[id].title} ↗
    </a>
  );
}
export function PlantAstrology({ slug }) {
  const { data: user } = useCurrentUser();
  const profile = useJournalQuery(user, "profile");
  const entry = plantCorrespondences[slug];
  if (!profile.data?.astrology_enabled) return null;
  const matches = connections(profile.data, entry);
  return (
    <section id="astrology" className="atlas-detail-section journal-card">
      <p className="herb-kicker">Optional / Traditional correspondences</p>
      <h2>Plant & planets</h2>
      {entry ? (
        <>
          <p>
            <strong>{entry.planet}</strong>
            {entry.signs.length
              ? ` · ${entry.signs.join(", ")}`
              : " · No explicit sign in this entry"}
          </p>
          <p>Historical body association: {entry.body}.</p>
          <p>{entry.note}</p>
          {matches.length ? (
            <ul>
              {matches.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          ) : (
            <p>
              No direct correspondence with your saved placements in this
              edition.
            </p>
          )}
          <p>
            Source heading: {entry.heading}. <Source id="culpeper" />
          </p>
        </>
      ) : (
        <p>
          No species-specific correspondence has been verified for this plant in
          this edition.
        </p>
      )}
      <p className="journal-note">
        Historical symbolism does not establish medicinal suitability or predict
        illness.
      </p>
      <a href="/herbs?view=profile">Edit your chart & explore the library →</a>
    </section>
  );
}
export default function AstrologyLibrary({ profile }) {
  const [tab, setTab] = useState("plants");
  const [search, setSearch] = useState("");
  const [planet, setPlanet] = useState("");
  const [mine, setMine] = useState(false);
  const entries = Object.entries(plantCorrespondences).filter(
    ([slug, e]) =>
      (!planet || e.planet === planet) &&
      (!mine || connections(profile, e).length) &&
      `${herbGuideBySlug[slug]?.name || slug} ${e.body} ${e.signs.join(" ")}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <section className="journal-library">
      <p className="herb-kicker">A source-led study shelf</p>
      <h2>Plants, planets & the body</h2>
      <p>
        Explore Western planetary herbalism and the Zodiac Man tradition.
        Associations describe a historical worldview; they do not predict your
        health or select treatments.
      </p>
      <div className="journal-tabs" aria-label="Correspondence library">
        {["plants", "signs", "planets", "systems"].map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === "plants" && (
        <>
          <div className="journal-grid">
            <label>
              Find a plant, sign or body association
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Try heart or Cancer"
              />
            </label>
            <label>
              Planet
              <select
                value={planet}
                onChange={(e) => setPlanet(e.target.value)}
              >
                <option value="">All planets</option>
                {planets.map((p) => (
                  <option key={p.name}>{p.name}</option>
                ))}
              </select>
            </label>
          </div>
          {profile?.astrology_enabled && (
            <label className="journal-check">
              <input
                type="checkbox"
                checked={mine}
                onChange={(e) => setMine(e.target.checked)}
              />{" "}
              Connected to my placements
            </label>
          )}
          <p className="journal-note">
            Named source: Culpeper, 1850 edition. A ruler match is an editorial
            connection, not a personalized prescription. Unverified plants stay
            unassigned.
          </p>
          <div className="journal-grid">
            {entries.map(([slug, e]) => (
              <article className="journal-card" key={slug}>
                <small>
                  {e.planet} · {e.signs.join(", ") || "No explicit plant sign"}
                </small>
                <h3>
                  {herbGuideBySlug[slug]?.name || slug.replaceAll("-", " ")}
                </h3>
                <p>Historical body association: {e.body}</p>
                <p>{e.note}</p>
                {connections(profile, e).map((m) => (
                  <p className="journal-match" key={m}>
                    {m}
                  </p>
                ))}
                <p>
                  Source heading: {e.heading}. <Source id="culpeper" />
                </p>
                {slug === "lemon-balm" && (
                  <p>
                    <Source id="melissa" />
                  </p>
                )}
                {herbGuideBySlug[slug] && (
                  <a href={`/herbs/atlas/${slug}`}>
                    Read plant identification & safety →
                  </a>
                )}
              </article>
            ))}
          </div>
          {!entries.length && (
            <p>
              No verified correspondences match these filters. Try all planets
              or turn off the placement filter.
            </p>
          )}
        </>
      )}
      {tab === "signs" && (
        <>
          <p>
            Twelve signs, using traditional seven-planet rulership. A body
            correspondence does not mean people of that sign have a typical
            disease.
          </p>
          <div className="journal-grid">
            {signs.map((s) => (
              <article className="journal-card" key={s.name}>
                <h3>{s.name}</h3>
                <p>
                  {s.element} · {s.ruler}
                </p>
                <p>{s.body}</p>
                <button
                  type="button"
                  onClick={() => {
                    setPlanet(s.ruler);
                    setMine(false);
                    setSearch("");
                    setTab("plants");
                  }}
                >
                  Explore {s.ruler} plants
                </button>
              </article>
            ))}
          </div>
          <Source id="zodiac" /> · <Source id="rulers" />
        </>
      )}
      {tab === "planets" && (
        <>
          <p>
            Traditional qualities and selected body associations. These differ
            from modern physiology and vary between authors.
          </p>
          <div className="journal-grid">
            {planets.map((p) => (
              <article className="journal-card" key={p.name}>
                <h3>{p.name}</h3>
                <p>{p.quality}</p>
                <p>Historical association: {p.body}</p>
                <button
                  type="button"
                  onClick={() => {
                    setPlanet(p.name);
                    setMine(false);
                    setSearch("");
                    setTab("plants");
                  }}
                >
                  Explore plants
                </button>
              </article>
            ))}
          </div>
          <Source id="qualities" /> · <Source id="culpeper" />
        </>
      )}
      {tab === "systems" && (
        <>
          <div className="journal-grid">
            {systems.map((s) => (
              <article className="journal-card" key={s.name}>
                <h3>{s.name}</h3>
                <p>{s.text}</p>
                <Source id={s.source} />
              </article>
            ))}
          </div>
          <p>
            This edition keeps Western historical correspondences separate from
            Ayurveda, Jyotisha, Chinese medicine and modern magical herbalism.
            They require their own source-specific mappings; selecting a
            sidereal chart does not switch to a Vedic medical system.
          </p>
          <p>
            Capricorn maps to the knees in the Zodiac Man tradition. We do not
            encode “Capricorns have tension headaches.” In Culpeper, lemon balm
            belongs to Jupiter and Cancer, not Saturn.
          </p>
        </>
      )}
    </section>
  );
}
