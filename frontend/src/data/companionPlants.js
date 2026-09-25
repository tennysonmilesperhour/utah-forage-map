import plants from './companion-plants.json' with { type: 'json' }
export const recordPlants = plants.filter(plant => plant.status !== 'toxic')
export const recordPlantBySlug = Object.fromEntries(recordPlants.map(plant => [plant.slug, plant]))
