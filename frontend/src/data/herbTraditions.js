export const gatheringSequence = [
  {
    title: 'Arrive before reaching',
    body: 'Pause at the edge of the patch. Notice your pace, the weather, other lives using the place, and whether gathering is truly needed today.',
    practice: 'Take three unhurried breaths and name your purpose in one sentence.',
  },
  {
    title: 'Ask and listen',
    body: 'Consent can be held as a spiritual relationship and as close ecological attention. Ask inwardly, then look outwardly: Is the population abundant? Is the plant vigorous? Is this a lawful and clean place to gather?',
    practice: 'Receive “not today” as a complete answer. Observation alone can fulfill the visit.',
  },
  {
    title: 'Choose the right individual',
    body: 'Seek mature, healthy material at the proper stage. Pass over the first plant, the only plant, stressed plants, and plants serving as active food or shelter.',
    practice: 'Walk the whole patch before deciding whether and where to harvest.',
  },
  {
    title: 'Take with restraint',
    body: 'Gather only the part you can identify, prepare, and use. Spread a light harvest across abundance rather than concentrating it in one place.',
    practice: 'Decide your stopping point before the first cut, and stop sooner if the patch asks it of you.',
  },
  {
    title: 'Return something useful',
    body: 'Reciprocity need not mean leaving an object. Remove litter, protect nearby seedlings, loosen no more soil than necessary, share seeds where appropriate, tend habitat, or support the people safeguarding the land.',
    practice: 'Do not leave coins, crystals, food, tobacco, hair, or other material unless that offering belongs to your own tradition and is ecologically appropriate there.',
  },
  {
    title: 'Close and remember',
    body: 'Thank the plant, place, teachers, and unseen labor that made the meeting possible. Record enough detail to learn how this place changes.',
    practice: 'Note date, moon, weather, phenological signs, part taken, amount left, preparation, and what you will do for the patch.',
  },
]

export const partWindows = [
  { part: 'Tender leaves', season: 'Spring and early growth', signs: 'Full color, little insect damage, before or near first flowering.', time: 'After dew has lifted; earlier in the day for aromatic leaves.', counsel: 'Clip above a node where regrowth is possible. Do not strip a stem or patch.' },
  { part: 'Flowers', season: 'At the opening of bloom', signs: 'Freshly opened, fragrant, dry, and not browned or heavily occupied by pollinators.', time: 'Late morning on a dry day is a common herbalist’s window.', counsel: 'Leave most blossoms for seed, insects, birds, and the next generation.' },
  { part: 'Fruit and hips', season: 'When fully colored and ripe', signs: 'Species-appropriate color, aroma, firmness, and easy release.', time: 'Dry weather, after surface moisture clears.', counsel: 'Taste is never an identification test. Leave a generous share for wildlife.' },
  { part: 'Seeds', season: 'Late flower into dormancy', signs: 'Mature color, dry seed heads, and seed that releases naturally.', time: 'A still, dry day before wind or rain disperses the crop.', counsel: 'Gather into breathable paper and return some seed to suitable ground where lawful.' },
  { part: 'Roots and rhizomes', season: 'Autumn dieback or very early spring', signs: 'Above-ground energy has receded, or new growth has only just begun.', time: 'Cool soil with enough moisture to dig cleanly, but not saturated.', counsel: 'Root harvest usually ends a life. Favor cultivated, abundant, or invasive species and replant divisions when appropriate.' },
  { part: 'Bark and twigs', season: 'Traditionally near spring sap-rise or from winter pruning', signs: 'Correct tree identity, healthy tissue, and a harvest plan that will not girdle the tree.', time: 'Use pruned or recently fallen branches whenever possible.', counsel: 'Never ring a trunk. Bark medicine calls for training and especially conservative harvest.' },
  { part: 'Medicinal fungi', season: 'During the species’ local fruiting window', signs: 'Correct host or substrate, firm fruiting body, characteristic pores/gills/teeth, and no decay.', time: 'After fruiting begins and during weather suitable for clean drying.', counsel: 'Take only fruiting bodies; protect the wood, soil, and mycelial habitat. Leave young and mature specimens across the site.' },
]

export const moonCyclePractices = [
  { phase: 'New moon', arc: 'Stillness · roots · beginning unseen', work: 'Listen, scout, plan, clean tools, or gather roots where season and abundance already agree.', question: 'What is forming before it can be seen?' },
  { phase: 'Waxing crescent', arc: 'Invitation · first growth', work: 'Tend new shoots, begin a relationship with a patch, or gather a modest amount of tender leaf.', question: 'What deserves patient encouragement?' },
  { phase: 'First quarter', arc: 'Commitment · outward movement', work: 'Act on a clear plan: tend, transplant, or gather leafy material for a preparation already chosen.', question: 'What small promise am I ready to keep?' },
  { phase: 'Waxing gibbous', arc: 'Refinement · approaching fullness', work: 'Watch flower development closely and prepare drying screens, vessels, labels, and storage.', question: 'What needs adjustment before completion?' },
  { phase: 'Full moon', arc: 'Illumination · flower · offering', work: 'Honor flowers, fragrance, beauty, and outward ritual. Gather only when the plant’s earthly signs are also right.', question: 'What has become visible, and what should be shared?' },
  { phase: 'Waning gibbous', arc: 'Gratitude · distribution', work: 'Process what was gathered, share medicine or knowledge responsibly, and return care to the patch.', question: 'How can abundance circulate without becoming extraction?' },
  { phase: 'Last quarter', arc: 'Discernment · pruning · release', work: 'Prune where appropriate, clear spoiled stores, review notes, and reduce what no longer serves the practice.', question: 'What can be released with respect?' },
  { phase: 'Waning crescent', arc: 'Rest · rootward return', work: 'Favor quiet observation, root work in its proper season, tool repair, and closing unfinished records.', question: 'What asks for rest rather than effort?' },
]

export function moonPracticeFor(phase) {
  return moonCyclePractices.find(item => item.phase === phase) ?? moonCyclePractices[0]
}

export const skyWays = [
  {
    title: 'Moon phase as ritual rhythm',
    lineage: 'Widespread folk practice; especially visible in European and Euro-American lunar gardening',
    body: 'A simple working pattern pairs waxing light with shoots, leaves, flowers, and increase; waning light with roots, pruning, inward work, and release. It is a devotional rhythm, not a universal rule.',
  },
  {
    title: 'Root, leaf, flower, and fruit days',
    lineage: 'Modern biodynamic practice associated with Maria Thun',
    body: 'Biodynamic calendars relate the Moon’s sidereal passage through constellation groups to root, leaf, flower, or fruit work, while also attending to nodes, perigee, and other celestial events. The tropical-zodiac dial on this site is not a substitute for a current biodynamic calendar.',
  },
  {
    title: 'Maramataka',
    lineage: 'Mātauranga Māori; held differently by iwi, hapū, and rohe',
    body: 'Maramataka brings moon nights, stars, tides, weather, food gathering, planting, fishing, and human energy into a local living calendar. Learn the maramataka of the people and place concerned rather than lifting a single chart as universal Māori practice.',
  },
  {
    title: 'Stars as seasonal witnesses',
    lineage: 'Many place-based Indigenous and ancient land traditions',
    body: 'The rising or setting of particular stars can accompany rains, migrations, flowering, fruiting, and harvest seasons. Begin by learning which celestial markers are named by knowledge holders where you live, then observe how they meet present-day ecology.',
  },
]

export const lineageGuidance = [
  {
    title: 'Published Indigenous plant teachings',
    body: 'Read teachings as relationships among a particular people, language, plant, and homeland. Name the Nation and teacher. A published book can invite learning without granting permission to reproduce ceremony, claim identity, commercialize knowledge, or transplant a regional rule everywhere.',
  },
  {
    title: 'Your own ancestral and local lines',
    body: 'Go deeper where you have an actual relationship: family gardeners, elders, herbalists, cultural centers, tribal or First Nations publications, local language names, and repeated visits to one patch through a full year.',
  },
  {
    title: 'A personal practice',
    body: 'You may create private prayers, offerings, and correspondences. Call them personal rather than ancient or Indigenous unless you can name the source and have the standing to carry it forward.',
  },
]

export const fieldJournalPrompts = [
  'What changed in this patch since the last visit?',
  'Which plants, fungi, insects, birds, or animals were using it?',
  'What earthly signs said “ready,” and what signs said “wait”?',
  'What did the moon, stars, weather, and season mean within the tradition I chose?',
  'How much did I take, how much remained, and what will be made?',
  'What act of reciprocity did I complete—or commit to completing?',
  'What did I sense inwardly, without turning that feeling into a claim about safety or identity?',
]

export const traditionShelf = [
  { title: 'After the First Full Moon in April', author: 'Josephine Grant Peters with Beverly Ortiz', lineage: 'A California Indian elder’s plant knowledge, gathering ethics, and seasonal practice', url: 'https://www.routledge.com/After-the-First-Full-Moon-in-April-A-Sourcebook-of-Herbal-Medicine-from-a-California-Indian-Elder/Peters-Ortiz/p/book/9781611327915' },
  { title: 'Plants Have So Much to Give Us, All We Have to Do Is Ask', author: 'Mary Siisip Geniusz, edited by Wendy Makoons Geniusz', lineage: 'Anishinaabe botanical teachings and practical plant relationships', url: 'https://www.upress.umn.edu/9780816696765/plants-have-so-much-to-give-us-all-we-have-to-do-is-ask/' },
  { title: 'Held by the Land', author: 'Leigh Joseph', lineage: 'Squamish plant knowledge, wellness, relationship, and responsible harvest', url: 'https://quarto.com/books/9781577152941/held-by-the-land' },
  { title: 'Braiding Sweetgrass', author: 'Robin Wall Kimmerer', lineage: 'Citizen Potawatomi teachings braided with botany and an ethic of reciprocity', url: 'https://milkweed.org/book/braiding-sweetgrass' },
  { title: 'All the Land’s Surface Is Medicine', author: 'Ann Fienup-Riordan with Yup’ik knowledge holders', lineage: 'Yup’ik edible and medicinal plant knowledge of southwest Alaska', url: 'https://www.ubcpress.ca/yungcautnguuq-nunam-qainga-tamarmiall-the-lands-surface-is-medicine' },
  { title: 'Ancient Pathways, Ancestral Knowledge', author: 'Nancy J. Turner', lineage: 'Indigenous ethnobotany and ecological wisdom of northwestern North America', url: 'https://utpdistribution.com/9780773543805/ancient-pathways-ancestral-knowledge/' },
  { title: 'Living by the Moon: Te Maramataka a Te Whānau-ā-Apanui', author: 'Wiremu Tawhai', lineage: 'A place- and iwi-rooted Māori lunar calendar', url: 'https://www.allright.org.nz/tools/maramataka' },
  { title: 'Maria Thun Biodynamic Calendar', author: 'Titia Thun and Friedrich Thun', lineage: 'Contemporary biodynamic sowing, tending, and harvest calendar', url: 'https://www.florisbooks.co.uk/book/Titia-Thun/Maria%2BThun%2BBiodynamic%2BCalendar/9781782509974' },
  { title: 'Christopher Hobbs’s Medicinal Mushrooms', author: 'Christopher Hobbs', lineage: 'Medicinal fungi, preparation, cultivation, and respectful wild harvest', url: 'https://www.hachettebookgroup.com/titles/christopher-hobbs/christopher-hobbss-medicinal-mushrooms-the-essential-guide/9781635861679/' },
  { title: 'The Herbal Medicine-Maker’s Handbook', author: 'James Green', lineage: 'Harvest, drying, storage, and home medicine-making craft', url: 'https://www.penguinrandomhouse.com/books/198323/the-herbal-medicine-makers-handbook-by-james-green/' },
]

export const plantSpiritNotes = {
  'stinging-nettle': { lineage: 'European folk herbalism · contemporary lunar gardening', gift: 'Boundary, vitality, and the strength that protects tenderness.', rite: 'Before cutting, notice where the patch makes its own boundary. Ask what a respectful distance looks like today.', making: 'Name the preparation before gathering; take only the tender amount you can process promptly.' },
  dandelion: { lineage: 'European folk herbalism · contemporary lunar gardening', gift: 'Persistence, adaptation, and medicine close at hand.', rite: 'Meet this familiar plant without treating it as disposable. Thank the whole rosette before choosing leaf, flower, or root.', making: 'Let the part determine the season: young leaf and flower above; root during the plant’s inward turn.' },
  'common-yarrow': { lineage: 'European folk and protective herb lore', gift: 'Discernment, protection, and the integrity of a clear edge.', rite: 'Stand at the margin where yarrow often grows and name what you are protecting—and what you are willing to welcome.', making: 'Gather flowering tops in settled weather and leave a broad flowering presence behind.' },
  elderflower: { lineage: 'European elder lore', gift: 'Threshold, kinship, continuity, and respect for the dwelling tree.', rite: 'Approach elder as a host rather than raw material. Ask before taking and let restraint be part of the offering.', making: 'Decide whether this visit is for flowers or later berries; taking every flower also takes the autumn fruit.' },
  'wild-mint': { lineage: 'Western herbal practice · contemporary lunar gardening', gift: 'Clarity, refreshment, and alert presence.', rite: 'Attend first to water, bank, and neighboring plants. Let the health of the wet place decide whether you cut.', making: 'Prepare drying space before harvest so fragrance is not lost to a warm, crowded bundle.' },
  'red-clover': { lineage: 'European folk herbalism · contemporary lunar gardening', gift: 'Nourishment, fellowship, and the abundance of a shared field.', rite: 'Watch who is feeding at the blossoms. Harvest around pollinators, never through them.', making: 'Take fresh heads selectively and spread the harvest over a large stand.' },
  'greater-plantain': { lineage: 'European folk herbalism', gift: 'Wayfaring, resilience, and care found underfoot.', rite: 'Notice the paths that brought both you and this plant here. Choose a clean place away from the burdens of the road.', making: 'Take intact young leaves or mature seed, not both by habit; let purpose guide the part.' },
  mugwort: { lineage: 'European and East Asian ritual-herbal traditions', gift: 'Dream, threshold, protection, and attention to the unseen.', rite: 'State the tradition you are actually practicing. Mugwort carries distinct teachings in different cultures and they should not be collapsed into one story.', making: 'Keep ritual use distinct from casual ingestion; mark the bundle with species, date, place, and intended use.' },
  'dog-rose': { lineage: 'European folk herbalism and devotional flower lore', gift: 'Love with thorns: beauty, grief, protection, and ripening.', rite: 'Let flower and thorn be one teaching. Take without forcing your way through the living hedge.', making: 'Gather petals and hips in their separate seasons, leaving fruit for birds and seed.' },
  'lemon-balm': { lineage: 'European monastic and folk herbalism', gift: 'Welcome, gladness, and a gentle return to the senses.', rite: 'Rub no leaf until identity and permission are clear; then meet fragrance as relationship, not proof.', making: 'Harvest before flowering in dry weather and move quickly to shade and airflow.' },
  'german-chamomile': { lineage: 'European household and folk herbalism', gift: 'Rest, solar warmth, and strength expressed without hardness.', rite: 'Gather low to the earth and notice the many stages of bloom. Leave the field able to continue flowering.', making: 'Pick only open, dry heads and lay them in a single airy layer.' },
  calendula: { lineage: 'European and Mediterranean household herbalism', gift: 'Radiance, restoration, and the daily practice of turning toward light.', rite: 'Receive the flower’s brightness before taking it. In a tended garden, let gathering be part of ongoing care.', making: 'Pick open, resinous flower heads regularly while preserving enough bloom for insects and seed.' },
}
