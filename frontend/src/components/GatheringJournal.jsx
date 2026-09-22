import { useState } from "react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import {
  journalError,
  useJournalMutation,
  useJournalQuery,
} from "../hooks/useJournal";
import { herbGuides } from "../data/herbGuide";
import "../journal.css";
const blankPlace = {
  title: "",
  plant: "",
  latitude: "",
  longitude: "",
  notes: "",
  visibility: "inherit",
  public_exact: false,
  public_history: false,
};
function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function Status({ mutation }) {
  return (
    <>
      {mutation.error && <p role="alert">{journalError(mutation.error)}</p>}
      {mutation.isPending && <p role="status">Saving…</p>}
    </>
  );
}
function PlaceForm({ initial = blankPlace, onSave, busy, onCancel }) {
  const [form, setForm] = useState(() => ({
    ...initial,
    plant:
      initial.plant ||
      herbGuides.find(
        (p) =>
          p.slug === new URLSearchParams(window.location.search).get("plant"),
      )?.name ||
      "",
  }));
  const [locationError, setLocationError] = useState("");
  const change = (name, value) => setForm((f) => ({ ...f, [name]: value }));
  function locate() {
    if (!navigator.geolocation) {
      setLocationError(
        "Location is unavailable in this browser. Enter coordinates below.",
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setForm((f) => ({
          ...f,
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
        }));
        setLocationError("");
      },
      () =>
        setLocationError(
          "Location could not be read. Enter coordinates below.",
        ),
      { timeout: 10000 },
    );
  }
  return (
    <form
      className="journal-form journal-inset"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          ...form,
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
        });
      }}
    >
      <div className="journal-grid">
        <label>
          Place name
          <input
            required
            maxLength={120}
            value={form.title}
            onChange={(e) => change("title", e.target.value)}
          />
        </label>
        <label>
          Plant or mushroom
          <input
            list="journal-plants"
            required
            maxLength={120}
            value={form.plant}
            onChange={(e) => change("plant", e.target.value)}
          />
          <datalist id="journal-plants">
            {herbGuides.map((p) => (
              <option key={p.slug} value={p.name} />
            ))}
          </datalist>
        </label>
        <label>
          Latitude
          <input
            required
            type="number"
            step="any"
            min="-90"
            max="90"
            value={form.latitude}
            onChange={(e) => change("latitude", e.target.value)}
          />
        </label>
        <label>
          Longitude
          <input
            required
            type="number"
            step="any"
            min="-180"
            max="180"
            value={form.longitude}
            onChange={(e) => change("longitude", e.target.value)}
          />
        </label>
      </div>
      <button type="button" onClick={locate}>
        Use my current location
      </button>
      {locationError && <p role="alert">{locationError}</p>}
      <label>
        Field notes (you and invited readers only)
        <textarea
          maxLength={5000}
          value={form.notes}
          onChange={(e) => change("notes", e.target.value)}
        />
      </label>
      <label>
        Who can see this place?
        <select
          value={form.visibility}
          onChange={(e) => change("visibility", e.target.value)}
        >
          <option value="inherit">Follow collection sharing</option>
          <option value="private">
            Private exception (or individually invited readers)
          </option>
          <option value="public">Public, even in a private collection</option>
        </select>
      </label>
      <label className="journal-check">
        <input
          type="checkbox"
          checked={form.public_exact}
          onChange={(e) => change("public_exact", e.target.checked)}
        />{" "}
        Publish exact coordinates when this place is public
      </label>
      <label className="journal-check">
        <input
          type="checkbox"
          checked={form.public_history}
          onChange={(e) => change("public_history", e.target.checked)}
        />{" "}
        Publish harvest dates and amounts when this place is public
      </label>
      <p className="journal-note">
        Invited readers can see precise coordinates, field notes and harvest
        history. Public readers never see notes. Place names and plant names are
        public when shared, so keep sensitive directions out of names.
      </p>
      <div className="journal-actions">
        <button className="herb-solid-button" disabled={busy}>
          Save place
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
function HarvestForm({ initial, onSave, busy, onCancel }) {
  const [form, setForm] = useState(
    initial || {
      gathered_on: localDate(),
      weight: "",
      unit: "g",
      percent_taken: "",
      available_basis: "",
      notes: "",
    },
  );
  const change = (name, value) => setForm((f) => ({ ...f, [name]: value }));
  return (
    <form
      className="journal-form journal-inset"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          ...form,
          weight:
            form.weight === "" || form.weight == null
              ? null
              : Number(form.weight),
          unit:
            form.weight === "" || form.weight == null ? null : form.unit || "g",
          percent_taken:
            form.percent_taken === "" || form.percent_taken == null
              ? null
              : Number(form.percent_taken),
        });
      }}
    >
      <h4>Record a harvest</h4>
      <div className="journal-grid">
        <label>
          Gathered on
          <input
            required
            type="date"
            max={localDate()}
            value={form.gathered_on}
            onChange={(e) => change("gathered_on", e.target.value)}
          />
        </label>
        <label>
          Weight
          <input
            type="number"
            min="0.001"
            max="1000000"
            step="any"
            value={form.weight ?? ""}
            onChange={(e) => change("weight", e.target.value)}
          />
        </label>
        <label>
          Weight unit
          <select
            value={form.unit || "g"}
            onChange={(e) => change("unit", e.target.value)}
          >
            {["g", "kg", "oz", "lb"].map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </label>
        <label>
          Estimated % taken
          <input
            type="number"
            min="0.001"
            max="100"
            step="any"
            value={form.percent_taken ?? ""}
            onChange={(e) => change("percent_taken", e.target.value)}
          />
        </label>
      </div>
      <label>
        What was the percentage based on?
        <input
          required={form.percent_taken !== "" && form.percent_taken != null}
          maxLength={240}
          placeholder="e.g. mature leaves in the surveyed patch"
          value={form.available_basis}
          onChange={(e) => change("available_basis", e.target.value)}
        />
      </label>
      <label>
        Harvest notes
        <textarea
          maxLength={5000}
          value={form.notes}
          onChange={(e) => change("notes", e.target.value)}
        />
      </label>
      <p className="journal-note">
        Record weight, percentage, or both. Each percentage describes this
        visit, not a cumulative share of the patch. No universal percentage is
        safe for every species or location.
      </p>
      <div className="journal-actions">
        <button className="herb-solid-button" disabled={busy}>
          Save harvest
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
function Place({ place, user }) {
  const [mode, setMode] = useState(null);
  const mutation = useJournalMutation(user);
  const owner = place.access === "owner";
  const fields = Object.fromEntries(
    Object.keys(blankPlace).map((k) => [k, place[k]]),
  );
  async function save(path, data, method = "post") {
    try {
      await mutation.mutateAsync({ path, data, method });
      setMode(null);
    } catch {
      /* Status renders request errors. */
    }
  }
  return (
    <article className="journal-card">
      <small>
        {place.access === "owner" ? place.visibility : place.access} · Gathering
        place
      </small>
      <h3>{place.title}</h3>
      <p>{place.plant}</p>
      {place.latitude != null ? (
        <p>
          <a
            href={`https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=16/${place.latitude}/${place.longitude}`}
            target="_blank"
            rel="noreferrer"
          >
            {place.latitude.toFixed(5)}, {place.longitude.toFixed(5)} ↗
          </a>
        </p>
      ) : (
        <p>Exact location is private.</p>
      )}
      {place.notes && <p>{place.notes}</p>}
      {owner && (
        <div className="journal-actions">
          <button onClick={() => setMode("harvest")}>Log harvest</button>
          <button onClick={() => setMode("edit")}>Edit place & privacy</button>
          <button
            onClick={() => {
              if (window.confirm("Delete this place and its harvest history?"))
                mutation.mutate({
                  path: `places/${place.id}`,
                  method: "delete",
                });
            }}
          >
            Delete place
          </button>
        </div>
      )}
      {mode === "edit" && (
        <PlaceForm
          initial={fields}
          busy={mutation.isPending}
          onCancel={() => setMode(null)}
          onSave={(data) => save(`places/${place.id}`, data, "put")}
        />
      )}
      {mode === "harvest" && (
        <HarvestForm
          busy={mutation.isPending}
          onCancel={() => setMode(null)}
          onSave={(data) => save(`places/${place.id}/harvests`, data)}
        />
      )}
      <details open={place.harvests.length > 0}>
        <summary>
          Harvest history · {place.harvests.length} visible visits
        </summary>
        {!place.harvests.length && <p>No visible harvest records.</p>}
        {place.harvests.map((h) => (
          <div className="journal-harvest" key={h.id}>
            <strong>{h.gathered_on}</strong>
            <p>
              {h.weight != null ? `${h.weight} ${h.unit}` : ""}
              {h.weight != null && h.percent_taken != null ? " · " : ""}
              {h.percent_taken != null ? `${h.percent_taken}% taken` : ""}
            </p>
            {h.available_basis && <p>Estimate based on: {h.available_basis}</p>}
            {h.notes && <p>{h.notes}</p>}
            {owner && (
              <div className="journal-actions">
                <button onClick={() => setMode(h.id)}>Edit harvest</button>
                <button
                  onClick={() => {
                    if (window.confirm("Delete this harvest record?"))
                      mutation.mutate({
                        path: `harvests/${h.id}`,
                        method: "delete",
                      });
                  }}
                >
                  Delete harvest
                </button>
              </div>
            )}
            {mode === h.id && (
              <HarvestForm
                initial={Object.fromEntries(
                  [
                    "gathered_on",
                    "weight",
                    "unit",
                    "percent_taken",
                    "available_basis",
                    "notes",
                  ].map((k) => [k, h[k]]),
                )}
                busy={mutation.isPending}
                onCancel={() => setMode(null)}
                onSave={(data) => save(`harvests/${h.id}`, data, "put")}
              />
            )}
          </div>
        ))}
      </details>
      <Status mutation={mutation} />
    </article>
  );
}
function Sharing({ collection, user }) {
  const query = useJournalQuery(user, `collections/${collection.id}/grants`);
  const mutation = useJournalMutation(user);
  const [username, setUsername] = useState("");
  const [scope, setScope] = useState("");
  const [title, setTitle] = useState(collection.title);
  const [visibility, setVisibility] = useState(collection.visibility);
  return (
    <section className="journal-inset journal-form">
      <h3>Sharing & access</h3>
      <form
        className="journal-form"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate({
            path: `collections/${collection.id}`,
            method: "put",
            data: { title, visibility },
          });
        }}
      >
        <label>
          Collection name
          <input
            required
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          Collection visibility
          <select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value)}
          >
            <option value="private">Private / invited accounts only</option>
            <option value="public">Public</option>
          </select>
        </label>
        <p>
          Public includes places that follow the collection. Private exceptions
          stay excluded; individually public places remain public even when the
          collection is private.
        </p>
        <button disabled={mutation.isPending}>Save collection settings</button>
      </form>
      <p>
        <a
          href={`/herbs?view=collections&collection=${collection.id}`}
          target="_blank"
          rel="noreferrer"
        >
          Preview public page ↗
        </a>{" "}
        · Copy this page’s URL to share publicly.
      </p>
      <form
        className="journal-form"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await mutation.mutateAsync({
              path: `collections/${collection.id}/grants`,
              data: { username, place_id: scope || null },
            });
            setUsername("");
          } catch {
            /* Status displays error. */
          }
        }}
      >
        <label>
          Give exclusive read access to an existing username
          <input
            required
            maxLength={120}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label>
          Access scope
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="">
              Whole collection (except private exceptions)
            </option>
            {collection.places.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <p>
          Readers sign in with their own account and find this under Gathering
          collections. No email is sent. Access includes exact locations, notes
          and history; readers cannot edit your records.
        </p>
        <button disabled={mutation.isPending}>Grant access</button>
      </form>
      {query.isPending && <p>Loading access list…</p>}
      {query.error && <p role="alert">{journalError(query.error)}</p>}
      {query.data?.map((g) => (
        <div className="journal-harvest" key={g.id}>
          <p>
            {g.username} ·{" "}
            {g.resource_key === "all"
              ? "Whole collection"
              : collection.places.find((p) => p.id === g.resource_key)?.title ||
                "Selected place"}
          </p>
          <button
            disabled={mutation.isPending}
            onClick={() =>
              mutation.mutate({ path: `grants/${g.id}`, method: "delete" })
            }
          >
            Revoke access
          </button>
        </div>
      ))}
      <p className="journal-note">
        Revocation removes future account access. It cannot retract information
        already copied. Publicly shared records remain public until their
        visibility changes.
      </p>
      <Status mutation={mutation} />
    </section>
  );
}
function Collection({ collection, user }) {
  const [adding, setAdding] = useState(false);
  const mutation = useJournalMutation(user);
  const owner = collection.access === "owner";
  const [search, setSearch] = useState("");
  const places = collection.places.filter((p) =>
    `${p.title} ${p.plant}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section className="journal-collection">
      <div className="journal-heading">
        <div>
          <small>
            {owner ? collection.visibility : "Shared with you"} ·{" "}
            {collection.places.length} places
          </small>
          <h2>{collection.title}</h2>
        </div>
        {owner && (
          <button
            className="herb-solid-button"
            onClick={() => setAdding(!adding)}
          >
            Add gathering place
          </button>
        )}
      </div>
      {owner && (
        <details>
          <summary>Manage sharing & collection</summary>
          <Sharing collection={collection} user={user} />
          <button
            className="journal-danger"
            onClick={() => {
              if (
                window.confirm(
                  "Delete this entire collection, all places and harvest records?",
                )
              )
                mutation.mutate({
                  path: `collections/${collection.id}`,
                  method: "delete",
                });
            }}
          >
            Delete collection
          </button>
        </details>
      )}
      {adding && (
        <PlaceForm
          busy={mutation.isPending}
          onCancel={() => setAdding(false)}
          onSave={async (data) => {
            try {
              await mutation.mutateAsync({
                path: `collections/${collection.id}/places`,
                data,
              });
              setAdding(false);
            } catch {
              /* Status displays error. */
            }
          }}
        />
      )}
      <Status mutation={mutation} />
      <label>
        Find within this collection
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Plant or place name"
        />
      </label>
      {places.map((p) => (
        <Place key={p.id} place={p} user={user} />
      ))}
      {!places.length && (
        <p>
          {collection.places.length
            ? "No matching places."
            : "No places yet. Add a patch you want to revisit."}
        </p>
      )}
    </section>
  );
}
export default function GatheringJournal({ user, onAuth }) {
  const [title, setTitle] = useState("");
  const query = useJournalQuery(user, "collections");
  const mutation = useJournalMutation(user);
  const publicId = new URLSearchParams(window.location.search).get(
    "collection",
  );
  const publicQuery = useQuery({
    queryKey: ["public-collection", publicId],
    enabled: !!publicId,
    queryFn: async () =>
      (
        await axios.get(
          `/api/collections/${encodeURIComponent(publicId)}/public`,
        )
      ).data,
    retry: false,
  });
  return (
    <main className="journal-page">
      <p className="herb-kicker">Gather lightly. Remember the place.</p>
      <h1>
        {publicId
          ? "Shared gathering collection"
          : "Your gathering collections"}
      </h1>
      <nav className="journal-tabs">
        <a href="/herbs?view=profile">Your profile</a>
        <a href="/herbs?view=collections">Your collections</a>
        <a href="/herbs?view=pantry">Pantry</a>
      </nav>
      {publicId ? (
        <>
          {publicQuery.isPending ? (
            <p>Loading public collection…</p>
          ) : publicQuery.error ? (
            <p role="alert">
              This collection has no public page, or is no longer available.
            </p>
          ) : (
            <>
              <h2>{publicQuery.data.title}</h2>
              {publicQuery.data.places.map((p) => (
                <Place key={p.id} place={p} />
              ))}
              {!publicQuery.data.places.length && (
                <p>No public places in this collection.</p>
              )}
            </>
          )}
        </>
      ) : !user ? (
        <>
          <p>Sign in to save private gathering places and log what you take.</p>
          <button className="herb-solid-button" onClick={() => onAuth("login")}>
            Sign in
          </button>
        </>
      ) : (
        <>
          <p>
            New collections are private. Keep exact places for yourself, invite
            trusted people, or choose what to publish.
          </p>
          <form
            className="journal-card journal-form"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await mutation.mutateAsync({
                  path: "collections",
                  data: { title },
                });
                setTitle("");
              } catch {
                /* Status displays error. */
              }
            }}
          >
            <label>
              New collection name
              <input
                required
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Creekside tea plants"
              />
            </label>
            <button className="herb-solid-button" disabled={mutation.isPending}>
              Create private collection
            </button>
            <Status mutation={mutation} />
          </form>
          {query.isPending && <p role="status">Loading collections…</p>}
          {query.error && (
            <p role="alert">
              {journalError(query.error)}{" "}
              <button onClick={() => query.refetch()}>Retry</button>
            </p>
          )}
          {query.data?.map((c) => (
            <Collection key={c.id} collection={c} user={user} />
          ))}
          {query.data?.length === 0 && (
            <p>
              Your field journal starts with a collection. Invited collections
              also appear here.
            </p>
          )}
        </>
      )}
    </main>
  );
}
