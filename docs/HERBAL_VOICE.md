# The Verdant Hours: guidance voice

The herbal companion speaks as a patient field companion: warm, observant, emotionally honest, and specific about the place in front of the reader. Invite a response; let the reader decline. Practical field guidance remains the basis for gathering decisions.

## Requested influences

- **Feelings Buried Alive Never Die… — Karol K. Truman.** The publisher description emphasizes recognizing and attending to feelings. We use that broad theme to invite naming a feeling and choosing a kind next action. Source: [publisher description on Apple Books](https://books.apple.com/us/book/feelings-buried-alive-never-die/id725612630).
- **Animal-Speak — Ted Andrews.** The publisher describes learning from animal behavior and interpreting encounters with nature symbolically. We invite observation before personal interpretation and practical care for wildlife. Source: [Llewellyn](https://www.llewellyn.com/product.php?ean=9780875420288).

These sources establish the broad influences, not a chapter-by-chapter adaptation. All guidance is original. Do not reproduce the books’ passages, scripts, feeling lists, animal dictionaries, or distinctive exercises. Do not claim that either author wrote, endorsed, or supplied the plant pairings. The herb reflections are our own editorial applications; the source disclosure makes that explicit.

## In-product expression

1. **Today:** an optional three-step field pause, available to guests. Arrive with a feeling, notice an actual encounter, and choose a small act of care. Users may skip any step and finish without selecting anything. Selection state remains in React memory and is cleared on closing or leaving Today; it is never added to analytics, API requests, or browser storage.
2. **Plant atlas:** each of the twelve current herbs has a specific observation, an inward question, and a practical closing invitation after its identification and safety notes. No touching, picking, tasting, or preparing is needed for reflection.
3. **Watch zones and pantry:** existing private note fields invite intentions, observations, and reflection alongside practical records. Those notes retain their existing account storage behavior.
4. **Attribution:** expandable source notes appear beside the field practice and plant reflections.

## Editorial boundaries

- Acknowledge sadness, frustration, uncertainty, and mixed feelings without classifying them as failures or demanding positivity, release, forgiveness, or disclosure.
- Do not map illness to buried feelings, suggest that emotions cause a user’s illness, or promise emotional or physical healing.
- Never prescribe a plant for an emotion, infer an herb recommendation from a feeling, or add ingestion, dosage, or treatment advice to these prompts.
- Describe what the visitor actually observed before inviting personal meaning. Do not assign fixed omens, predictions, or animal identities; do not invent an encounter.
- Spiritual meaning is optional. It cannot establish species identity, edibility, harvest readiness, or medical safety.
- Treat wildlife as living animals with their own needs. Keep distance, leave routes and nests undisturbed, and do not encourage feeding or handling.
- Do not present these original prompts as Indigenous teachings or universal cultural correspondences.

## Maintaining the guidance

Edit `frontend/src/data/herbWisdom.js` for feeling, encounter, and plant prompts. Keep each plant reflection keyed by its atlas slug. `HerbFieldPractice` manages the ephemeral interaction; `HerbPlantReflection` renders the per-plant prompts; `HerbWisdomSources` supplies shared attribution. Use ordinary questions and concrete observations, and keep all reflection optional.
