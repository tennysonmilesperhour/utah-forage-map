import { useState } from "react";
import { placements, signs } from "../data/astrology";
import {
  journalError,
  useJournalMutation,
  useJournalQuery,
} from "../hooks/useJournal";
import AstrologyLibrary from "./AstrologyLibrary";
function ProfileForm({ user, initial }) {
  const [form, setForm] = useState(initial);
  const save = useJournalMutation(user);
  return (
    <>
      <form
        className="journal-card journal-form"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate({ path: "profile", method: "put", data: form });
        }}
      >
        <h2>Your forager profile</h2>
        <p>
          Visible only to you. Collection sharing never shares your profile or
          chart.
        </p>
        <div className="journal-grid">
          <label>
            Display name
            <input
              maxLength={100}
              value={form.display_name}
              onChange={(e) =>
                setForm({ ...form, display_name: e.target.value })
              }
            />
          </label>
          <label>
            About your practice
            <textarea
              maxLength={1000}
              value={form.bio}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
            />
          </label>
        </div>
        <label className="journal-check">
          <input
            type="checkbox"
            checked={form.astrology_enabled}
            onChange={(e) =>
              setForm({ ...form, astrology_enabled: e.target.checked })
            }
          />{" "}
          Show astrology connections on plant pages
        </label>
        {form.astrology_enabled && (
          <>
            <p>
              Enter placements from a chart you trust. Unknown placements can
              stay blank. Birth date, time and birthplace are not required or
              stored; this form does not calculate a natal chart.
            </p>
            <label>
              Chart zodiac
              <select
                value={form.zodiac}
                onChange={(e) => setForm({ ...form, zodiac: e.target.value })}
              >
                <option value="tropical">Tropical</option>
                <option value="sidereal">
                  Sidereal (enter your existing chart)
                </option>
              </select>
            </label>
            <div className="journal-grid">
              {placements.map((p) => (
                <label key={p}>
                  {p}
                  <select
                    value={form.placements[p] || ""}
                    onChange={(e) => {
                      const next = { ...form.placements };
                      if (e.target.value) next[p] = e.target.value;
                      else delete next[p];
                      setForm({ ...form, placements: next });
                    }}
                  >
                    <option value="">Unknown / not entered</option>
                    {signs.map((s) => (
                      <option key={s.name}>{s.name}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setForm({ ...form, placements: {} })}
            >
              Clear chart placements
            </button>
          </>
        )}
        <button className="herb-solid-button" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save profile"}
        </button>
        {save.error && <p role="alert">{journalError(save.error)}</p>}
        {save.isSuccess && <p role="status">Profile saved.</p>}
      </form>
      <AstrologyLibrary profile={save.data || initial} />
    </>
  );
}
export default function ForagerProfile({ user, onAuth }) {
  const query = useJournalQuery(user, "profile");
  return (
    <main className="journal-page">
      <p className="herb-kicker">Your field companion</p>
      <h1>A practice of your own.</h1>
      <nav className="journal-tabs">
        <a href="/herbs?view=collections">Gathering collections →</a>
        <a href="/herbs?view=pantry">Your pantry →</a>
      </nav>
      {!user ? (
        <>
          <p>Sign in to keep a private profile and chart.</p>
          <button className="herb-solid-button" onClick={() => onAuth("login")}>
            Sign in
          </button>
          <AstrologyLibrary />
        </>
      ) : query.isPending ? (
        <p role="status">Loading profile…</p>
      ) : query.error ? (
        <p role="alert">
          {journalError(query.error)}{" "}
          <button onClick={() => query.refetch()}>Retry</button>
        </p>
      ) : (
        <ProfileForm key={user.id} user={user} initial={query.data} />
      )}
    </main>
  );
}
