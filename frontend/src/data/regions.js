export const regions = [
  { slug: 'pacific-northwest', name: 'Pacific Northwest', description: 'Coastal forests and inland mountain ranges from northern California through British Columbia and southeast Alaska.', bounds: [-130, 40, -116, 60], center: [-123, 49], hemisphere: 'north' },
  { slug: 'rocky-mountains', name: 'Rocky Mountains', description: 'High-elevation conifer forests and aspen country from New Mexico through the Canadian Rockies.', bounds: [-117, 31, -102, 54], center: [-110, 42], hemisphere: 'north' },
  { slug: 'northeastern-north-america', name: 'Northeastern North America', description: 'Temperate hardwood and mixed forests across the Great Lakes, New England, eastern Canada, and Appalachia.', bounds: [-86, 35, -58, 56], center: [-72, 45], hemisphere: 'north' },
  { slug: 'southeastern-north-america', name: 'Southeastern North America', description: 'Warm hardwood, pine, and subtropical habitats from the Gulf Coast through the southern Appalachians.', bounds: [-100, 24, -74, 38], center: [-86, 31], hemisphere: 'north' },
  { slug: 'western-europe', name: 'Western Europe', description: 'Atlantic woodlands, managed forests, and upland habitats from Iberia through the British Isles and central Europe.', bounds: [-12, 36, 17, 61], center: [2, 49], hemisphere: 'north' },
  { slug: 'northern-europe', name: 'Northern Europe', description: 'Boreal forest, birch woodland, and cool maritime habitats across Scandinavia and the Baltic region.', bounds: [-12, 54, 33, 72], center: [15, 63], hemisphere: 'north' },
  { slug: 'east-asia', name: 'East Asia', description: 'Temperate and subtropical forests spanning eastern China, Korea, Japan, Taiwan, and nearby islands.', bounds: [100, 20, 150, 51], center: [125, 35], hemisphere: 'north' },
  { slug: 'southern-australia', name: 'Southern Australia', description: "Eucalypt forest, temperate rainforest, and cool coastal country across the continent's southern arc and Tasmania.", bounds: [110, -45, 155, -25], center: [135, -36], hemisphere: 'south' },
  { slug: 'new-zealand', name: 'New Zealand', description: 'Native beech forest, mixed woodland, pasture, and wet coastal habitats across Aotearoa New Zealand.', bounds: [165, -48, 179.9, -33], center: [172, -41], hemisphere: 'south' },
  { slug: 'southern-south-america', name: 'Southern South America', description: 'Andean forest, Valdivian rainforest, Patagonian woodland, and cool grasslands in Chile and Argentina.', bounds: [-76, -56, -55, -30], center: [-68, -43], hemisphere: 'south' },
]

export const regionBySlug = Object.fromEntries(regions.map(region => [region.slug, region]))
