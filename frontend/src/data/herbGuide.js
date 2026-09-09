import profiles from './herb-guide.json' with { type: 'json' }

export const herbGuides = profiles
export const herbGuideBySlug = Object.fromEntries(profiles.map(plant => [plant.slug, plant]))
export const GUIDE_CHECKED = '2026-09-09'
export const HERB_ATLAS_PATH = '/herbs/atlas'
export const habitatLabels = { woodland: 'Woodland', hedgerow: 'Hedgerows', meadow: 'Meadows', 'wet-ground': 'Wet ground', coastal: 'Coasts', scrub: 'Scrub & fynbos', disturbed: 'Disturbed ground', garden: 'Gardens & cultivation' }
export const useLabels = { food: 'Culinary history', tea: 'Tea plants', study: 'Botanical study', craft: 'Craft & plant lore', toxic: 'Toxic references' }
export const statusLabels = { culinary: 'Culinary reference', caution: 'Extra care needed', study: 'Study first', toxic: 'Toxic · do not eat' }
export const stageLabels = { 'fresh-growth': 'Fresh growth', flowering: 'Flowering', fruiting: 'Fruiting', seed: 'Mature seed', 'all-stages': 'Hazard at every stage' }
export const herbRegions = [
  { slug: 'north-america', name: 'North America', subtitle: 'Woodlands, meadows & tropical gardens', description: 'From northern nettles to tropical American culantro, this is a continent of different growing seasons. The Caribbean and Central America are included here. Begin with a flora for your state, province or island.', season: 'Track snowmelt, new leaves and local flowering in temperate areas. In tropical areas, follow rainfall and plant development. Elevation can shift a season substantially.', focus: 'Learn poison hemlock and the local Cicuta species before considering any wild carrot-family plant.', links: [['Native Plant Trust · Go Botany (New England)', 'https://gobotany.nativeplanttrust.org/'], ['NC State Extension · Plant Toolbox', 'https://plants.ces.ncsu.edu/']] },
  { slug: 'south-america', name: 'South America', subtitle: 'Andean shrubs & tropical food plants', description: 'This first collection centers on lemon verbena, epazote, culantro and cultivated tropical herbs. It is a starting point, with major gaps in Amazonian, Andean and southern temperate floras.', season: 'Use elevation, rainfall and the plant’s growth stage. A plant in a dry Andean valley and one in a humid lowland garden do not share a gathering calendar.', focus: 'Names such as cedrón and yerba luisa can refer to different plants. Check the scientific name and learn with regional specialists.', links: [['Kew POWO · Lemon verbena and regional sources', 'https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:1015994-1/general-information'], ['Flora e Funga do Brasil · Botanical directory', 'https://floradobrasil.jbrj.gov.br/reflora/']] },
  { slug: 'europe', name: 'Europe', subtitle: 'Spring woods & Mediterranean herbs', description: 'Explore woodland alliums, meadow plants, hedgerow flowers and aromatic herbs. Northern, Atlantic, continental and Mediterranean climates need different local references.', season: 'Follow spring leaf emergence, summer flowering and autumn fruiting. In Mediterranean areas, cool-season rainfall may drive leafy growth. Month names on a British source describe Britain.', focus: 'Study ramsons alongside lily of the valley and autumn crocus. Mixed spring leaf gatherings have caused serious and fatal poisoning.', links: [['BSBI · Plant Atlas 2020 (Britain & Ireland)', 'https://plantatlas2020.org/'], ['BfR · Wild garlic and toxic lookalikes', 'https://www.bfr.bund.de/en/press-release/wild-garlic-confusion-often-leads-to-poisoning/']] },
  { slug: 'africa', name: 'Africa', subtitle: 'Cape fynbos & cultivated tropical herbs', description: 'The opening collection connects Cape shrubs such as rooibos and buchu with tropical crops such as roselle and moringa. It does not yet represent Africa’s many local herbal traditions or floras.', season: 'Distinguish the Cape’s winter-rainfall habitats from summer-rainfall and equatorial regions. Use the local wet season, flowering and healthy regrowth as observation cues.', focus: 'Favor traceable cultivated sources for commercially gathered shrubs. A broad conservation category does not mean a particular patch can sustain harvesting.', links: [['SANBI · PlantZAfrica', 'https://pza.sanbi.org/'], ['SANBI · Buchu harvest-pressure assessment', 'https://redlist.sanbi.org/species.php?species=3359-22']] },
  { slug: 'asia', name: 'Asia', subtitle: 'Temperate herbs & monsoon gardens', description: 'Study familiar temperate plants alongside gotu kola, perilla, lemongrass and cultivated tropical herbs. Regional food traditions are context, not permission to substitute related species.', season: 'Separate temperate spring growth from monsoon and tropical growth cycles. Rainfall, drainage and cultivation affect whether a plant is actively growing.', focus: 'Verify local names against a scientific name. For wet-ground herbs, identify the plant and assess water quality as separate questions.', links: [['Singapore NParks · Flora & Fauna Web', 'https://www.nparks.gov.sg/florafaunaweb'], ['Kew · Medicinal Plant Names Services', 'https://mpns.science.kew.org/mpns-portal/']] },
  { slug: 'oceania', name: 'Oceania', subtitle: 'Rainforest leaves & coastal greens', description: 'Begin with Australian lemon myrtle, warrigal greens and selected introduced or cultivated herbs. Pacific island floras and Aotearoa New Zealand’s regional traditions need further dedicated coverage.', season: 'Follow local rainfall, fresh growth and plant maturity. Southern temperate seasons differ from tropical northern Australia and island climates.', focus: 'Learn with local and First Nations experts where knowledge is offered. Protect dunes and wetlands; favor cultivated bush-food plants.', links: [['Australian National Botanic Gardens · Lemon myrtle', 'https://www.anbg.gov.au/gnp/gnp14/backhousia-citriodora.html'], ['Botanic Gardens of Sydney · Bush-food gardens', 'https://www.botanicgardens.org.au/discover-and-learn/gardening-home/growing-native-gardens-and-bush-foods/tuck-bush-tucker-garden']] },
]
export const herbRegionBySlug = Object.fromEntries(herbRegions.map(region => [region.slug, region]))
export function normalizeHerbSearch(value) { return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim() }
export function filterHerbGuides(filters = {}) {
  const words = normalizeHerbSearch(filters.q || '').split(/\s+/).filter(Boolean)
  return herbGuides.filter(plant => {
    const haystack = normalizeHerbSearch([plant.name, plant.latin, plant.family, ...plant.aliases, ...plant.parts, ...plant.habitats.map(h => habitatLabels[h]), plant.summary].join(' '))
    return words.every(word => haystack.includes(word)) && (!filters.region || plant.regions.includes(filters.region)) && (!filters.habitat || plant.habitats.includes(filters.habitat)) && (!filters.use || plant.uses.includes(filters.use)) && (!filters.status || plant.status === filters.status) && (!filters.stage || plant.stages.includes(filters.stage)) && (!filters.saved || filters.saved.includes(plant.slug))
  }).sort((a, b) => a.name.localeCompare(b.name))
}
export function herbGuidePath(plant) { return `${HERB_ATLAS_PATH}/${plant.slug}` }
export function herbAtlasRoute(pathname) {
  const path = pathname.replace(/\/$/, '')
  if (path === HERB_ATLAS_PATH) return { type: 'index' }
  if (path === `${HERB_ATLAS_PATH}/compare`) return { type: 'compare' }
  if (path === '/herbs/regions') return { type: 'regions' }
  const region = herbRegionBySlug[path.replace('/herbs/regions/', '')]
  if (path.startsWith('/herbs/regions/') && region) return { type: 'region', region }
  const plant = herbGuideBySlug[path.replace(`${HERB_ATLAS_PATH}/`, '')]
  if (path.startsWith(`${HERB_ATLAS_PATH}/`) && plant) return { type: 'plant', plant }
  if (path === '/herbs/fieldcraft') return { type: 'fieldcraft' }
  return { type: 'missing' }
}
export function isHerbGuidePath(path) { return /^\/herbs\/(atlas|regions|fieldcraft)(\/|$)/.test(path) }

export function herbComparisonSelection(value = '') {
  const requested = value.split(',')
  return [0, 1].map(index => herbGuideBySlug[requested[index]] && (index === 0 || requested[index] !== requested[0]) ? requested[index] : '')
}
