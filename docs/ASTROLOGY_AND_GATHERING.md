# Profiles, correspondences and gathering journals

Implemented entry points: `/herbs?view=profile`, `/herbs?view=collections`, and optional Plant & planets sections in the atlas and classic plant detail. The fungi account desk links to the same account-wide profile and journal. Plants link to a gathering collection with the plant preselected in the place form.

## Research and content model

Checked 21 September 2026. The initial library separates four connected Western historical systems:

| System | Purpose in the app | Source |
| --- | --- | --- |
| Planetary herbalism | Named planet and any explicit signs on individual plants | [Culpeper, Complete Herbal, Thomas Kelly edition, 1850](https://www.gutenberg.org/files/49513/49513-h/49513-h.htm), plant headings |
| Medical astrology / melothesia | Browse 12 signs and their historical body associations | [NLM, Zodiac Man, Johannes de Ketham, 1493](https://www.nlm.nih.gov/hmd/topics/horse/sm-101146662_deKetham_zodiac.html); [Astrodienst, The Divine Zodiac](https://www.astro.com/astrology/in_rgzodiac_e.htm), sign/body sequence and traditional rulership |
| Humoral qualities | Explain hot/cold/moist/dry descriptions of seven traditional planets | [Al-Biruni, translated planetary qualities](https://renaissanceastrology.com/albiruniplanetsgeneral.html); Culpeper, Treatise of the Three Sorts of Vital Spirits and opening epistle |
| Sympathy / antipathy | Explain source-specific shared and opposing associations | Culpeper, opening instructions and Plantain entry |

These are historical classifications, not clinical findings. The application does not infer disease, offer dosages, or recommend treatment from a sign. The seven-planet organ descriptions are selected associations, not exhaustive anatomy. Culpeper's opening epistle names eyes (Sun/Moon), spleen (Saturn), liver (Jupiter), gall (Mars), reproductive organs (Venus); his discussion of animal virtue associates the brain with Mercury and Moon.

Important correction: Culpeper's BALM entry assigns Jupiter and Cancer. Saturn is cold/dry; a claim that Saturn is expansive and balm belongs to Saturn should not be represented as this tradition. Capricorn is associated with knees in the Zodiac Man sequence, not a validated predisposition to tension headaches. [EMA's Melissa leaf monograph summary](https://www.ema.europa.eu/en/medicines/herbal/melissae-folium) supports a traditional-use classification for mild stress, sleep and mild digestive symptoms; it does not establish a zodiac-specific effect or tension-headache treatment.

### Checked botanical mappings

| Atlas plant | Culpeper heading | Planet | Signs mentioned |
| --- | --- | --- | --- |
| Lemon balm | BALM | Jupiter | Cancer |
| Stinging nettle | NETTLES | Mars | None recorded |
| Greater plantain | PLANTAIN | Venus | None encoded; Culpeper disputes other authors' Mars attribution |
| Mugwort | MUGWORT | Venus | Taurus, Libra (Venus's signs invoked in the text) |
| Calendula | MARIGOLDS | Sun | Leo |
| Dandelion | DANDELION, VULGARLY CALLED PISS-A-BEDS | Jupiter | None recorded |
| Common yarrow | YARROW, CALLED NOSE-BLEED, MILFOIL AND THOUSAND-LEAL | Venus | None recorded |
| Common chickweed | CHICKWEED | Moon | None recorded |
| Cleavers | CLEAVERS | Moon | None recorded |
| Fennel | FENNEL | Mercury | Virgo |
| Common comfrey | COMFREY | Saturn | Capricorn, explicitly tentative in the source |

Historical common names are editorially linked to modern botanical profiles. They are not a substitute for species identification. Unchecked species are unassigned. Comfrey is explicitly marked for historical study and against internal use; atlas safety guidance remains visible.

A direct sign match and a match through the sign's traditional ruler are different explanations. No match is displayed as a health benefit. Users can enter Sun, Moon, Ascendant and other planetary placements manually, leave unknown values empty, opt out, or clear the chart. Tropical/sidereal labels describe the user's existing chart. No birth date/time/place is collected and no natal calculation is claimed. Ayurveda/Jyotisha, Chinese medicine, spagyrics and modern magical correspondence systems are not silently blended into Culpeper; further lineages require independent sourcing.

## Privacy and sharing contract

- Profile and chart are owner-only. Sharing a collection never shares them.
- New collections are private; new places inherit the collection.
- A place can inherit, be individually public, or be a private exception.
- Collection grants include current/future inherited places but exclude private exceptions. A separate place grant can explicitly share a private exception.
- Grants target an existing account's username. They are read-only, revocable, and send no message/email. Readers find collections in their own account.
- Invited readers see exact coordinates, notes and harvest history within the granted scope.
- Public places expose name and plant only unless the owner also enables exact coordinates and/or harvest dates/amounts. Notes and the percentage-estimate basis are never in the public projection. Sensitive directions should not be entered in public titles.
- An individually public/shared place never exposes the private parent collection's name.
- Private/profile, grant-list and collection responses use `Cache-Control: private, no-store`; public projections use `no-store`. Profile/collection views are noindex. Account query caches are scoped by user ID and cleared on logout.
- Deleting a collection/place removes dependent harvests/grants. Account deletion removes owned journal data and grants to the account. Revocation cannot retract previously copied information.

## Harvest records

Repeat visits are tied to a stable gathering place. Each records a calendar date, positive weight in g/kg/oz/lb, estimated percentage (greater than 0 through 100), or both; notes are optional. A percentage requires a description of the surveyed material so estimates are interpretable. Negative/nonfinite amounts, unmatched units, empty amounts and future dates are rejected. Visits can be edited or deleted. Percentages are not added together across visits and are not represented as a universal sustainable harvest threshold. This journal does not automatically add stock to the existing pantry.

## Deployment and validation

Migration: `fa720fb68728`, after `d71e20c946ab`. It adds five tables without altering existing records. Apply `alembic upgrade head` to the target database before deploying the new backend/frontend. Production does not automatically create these tables. Do not downgrade a database containing journals without first exporting/backing up the affected data.

Run frontend lint, production build and `node --test tests/*.test.mjs`; run backend unittest discovery, auth/import smoke scripts, and compileall. Tests cover default-private behavior, cross-account mutation refusal, public field projections, private exceptions, scoped grants/revocation, quantity validation, history edits and account cleanup. Browser review uses only an isolated local SQLite database and synthetic accounts.

Remaining scope: automatic natal chart calculation; independently sourced additional traditions and plant mappings; specialist historical/botanical review; harvest-to-pantry synchronization. None is implied to be implemented.
