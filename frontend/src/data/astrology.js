// Historical correspondences, never a medical recommendation engine.
export const sources = {
  culpeper: {
    title: "Culpeper · Complete Herbal, 1850 edition",
    url: "https://www.gutenberg.org/files/49513/49513-h/49513-h.htm",
  },
  zodiac: {
    title: "National Library of Medicine · Zodiac Man (1493)",
    url: "https://www.nlm.nih.gov/hmd/topics/horse/sm-101146662_deKetham_zodiac.html",
  },
  rulers: {
    title: "Astrodienst · The Divine Zodiac",
    url: "https://www.astro.com/astrology/in_rgzodiac_e.htm",
  },
  qualities: {
    title: "Al-Biruni · Planetary qualities (translated excerpt)",
    url: "https://renaissanceastrology.com/albiruniplanetsgeneral.html",
  },
  melissa: {
    title: "EMA · Melissa leaf: traditional use and evidence",
    url: "https://www.ema.europa.eu/en/medicines/herbal/melissae-folium",
  },
};
export const signs = [
  ["Aries", "Mars", "Fire", "Head and face"],
  ["Taurus", "Venus", "Earth", "Neck and throat"],
  ["Gemini", "Mercury", "Air", "Arms and shoulders"],
  ["Cancer", "Moon", "Water", "Chest and stomach"],
  ["Leo", "Sun", "Fire", "Heart and back"],
  ["Virgo", "Mercury", "Earth", "Abdomen and intestines"],
  ["Libra", "Venus", "Air", "Loins and kidneys"],
  ["Scorpio", "Mars", "Water", "Reproductive organs"],
  ["Sagittarius", "Jupiter", "Fire", "Hips and thighs"],
  ["Capricorn", "Saturn", "Earth", "Knees"],
  ["Aquarius", "Saturn", "Air", "Lower legs and ankles"],
  ["Pisces", "Jupiter", "Water", "Feet"],
].map(([name, ruler, element, body]) => ({ name, ruler, element, body }));
export const placements = [
  "Sun",
  "Moon",
  "Ascendant",
  "Mercury",
  "Venus",
  "Mars",
  "Jupiter",
  "Saturn",
  "Uranus",
  "Neptune",
  "Pluto",
];
export const planets = [
  ["Sun", "Hot and dry", "Heart and eyes"],
  ["Moon", "Cold and moist", "Brain and eyes"],
  [
    "Mercury",
    "Variable; takes on other influences",
    "Brain / rational faculty",
  ],
  ["Venus", "Moderately cold and moist", "Reproductive organs"],
  ["Mars", "Hot and dry", "Gall / bile"],
  ["Jupiter", "Moderately warm and moist", "Liver"],
  ["Saturn", "Cold and dry", "Spleen"],
].map(([name, quality, body]) => ({ name, quality, body }));
export const systems = [
  {
    name: "Planetary herbalism",
    source: "culpeper",
    text: "Culpeper assigns plants to planets and sometimes signs. The plant entry is the starting point; the ruler of a sign is a separate correspondence. Historical names do not always resolve to a single modern species.",
  },
  {
    name: "Medical astrology / melothesia",
    source: "zodiac",
    text: "The Zodiac Man maps signs to parts of the body, from Aries at the head to Pisces at the feet. These are symbolic historical associations, not evidence of a person’s vulnerabilities or likely illnesses.",
  },
  {
    name: "Humoral qualities",
    source: "qualities",
    text: "Hot, cold, moist and dry describe a traditional model of temperament. They are not measured body temperatures or modern physiological mechanisms. Jupiter is moderately warm and moist; Saturn is cold and dry.",
  },
  {
    name: "Sympathy and antipathy",
    source: "culpeper",
    text: "Culpeper describes working with a shared planetary association (sympathy) or an opposing influence (antipathy). We explain these historical ideas without using them to prescribe herbs or infer diagnoses.",
  },
];
// Specific headings checked against the primary text, 21 September 2026.
export const plantCorrespondences = {
  "lemon-balm": {
    planet: "Jupiter",
    signs: ["Cancer"],
    heading: "BALM",
    body: "Heart and stomach",
    note: "Culpeper explicitly assigns balm to Jupiter and Cancer. This differs from a Saturn attribution. The EMA recognizes traditional use for mild stress, sleep and mild digestive complaints; this does not establish treatment of tension headaches or a zodiac-specific benefit.",
  },
  "stinging-nettle": {
    planet: "Mars",
    signs: [],
    heading: "NETTLES",
    body: "Lungs",
    note: "The historical entry assigns nettles to Mars and discusses hot/dry qualities. Its broad common name requires botanical care.",
  },
  "greater-plantain": {
    planet: "Venus",
    signs: [],
    heading: "PLANTAIN",
    body: "Head",
    note: "Culpeper argues for Venus while reporting that other writers assigned plantain to Mars. This is a documented disagreement, not a universal correspondence.",
  },
  mugwort: {
    planet: "Venus",
    signs: ["Taurus", "Libra"],
    heading: "MUGWORT",
    body: "Reproductive and urinary organs",
    note: "The entry invokes Venus and her signs Taurus and Libra. Historical reproductive claims must not be used as instructions for pregnancy or childbirth.",
  },
  calendula: {
    planet: "Sun",
    signs: ["Leo"],
    heading: "MARIGOLDS",
    body: "Heart",
    note: "The historical marigold entry is assigned to the Sun and Leo. Read the modern botanical profile to distinguish calendula from other plants called marigold.",
  },
  dandelion: {
    planet: "Jupiter",
    signs: [],
    heading: "DANDELION, VULGARLY CALLED PISS-A-BEDS",
    body: "Liver, gall and spleen",
    note: "The dandelion entry names Jupiter. Historical organ claims are presented as history, not treatment guidance.",
  },
  "common-yarrow": {
    planet: "Venus",
    signs: [],
    heading: "YARROW, CALLED NOSE-BLEED, MILFOIL AND THOUSAND-LEAL",
    body: "Wounds and skin",
    note: "Culpeper names Venus. This historical association does not establish clinical effectiveness or safe preparation.",
  },
  chickweed: {
    planet: "Moon",
    signs: [],
    heading: "CHICKWEED",
    body: "Liver and skin",
    note: "The entry assigns chickweed to the Moon. Historical common names require care when matched to modern species.",
  },
  cleavers: {
    planet: "Moon",
    signs: [],
    heading: "CLEAVERS",
    body: "Heart",
    note: "Culpeper assigns cleavers to the Moon. His historical poison-treatment claims are not safe instructions and are not reproduced here.",
  },
  fennel: {
    planet: "Mercury",
    signs: ["Virgo"],
    heading: "FENNEL",
    body: "Stomach",
    note: "Culpeper names Mercury and Virgo, and describes antipathy to Pisces. This is a source-specific symbolic relationship.",
  },
  comfrey: {
    planet: "Saturn",
    signs: ["Capricorn"],
    heading: "COMFREY",
    body: "Bones and wounds",
    note: "Culpeper assigns Saturn and tentatively proposes Capricorn. Historical study only: comfrey contains pyrrolizidine alkaloids and must not be taken internally. Read the modern safety profile.",
  },
};
export function connections(profile, entry) {
  if (!profile?.astrology_enabled || !entry) return [];
  return Object.entries(profile.placements || {}).flatMap(
    ([placement, sign]) => {
      const zodiac = signs.find((s) => s.name === sign);
      if (entry.signs.includes(sign))
        return [`${placement} in ${sign}: sign named in the plant entry`];
      if (zodiac?.ruler === entry.planet)
        return [
          `${placement} in ${sign} → ${zodiac.ruler}: shared traditional ruler`,
        ];
      return [];
    },
  );
}
