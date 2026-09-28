import marks from './field-marks.json' with { type: 'json' }

// Structured field marks for the ID helper. Each species lists every value that fits,
// so a variable species (for example several cap colours) matches any of them.
export const fieldMarks = marks

const COLORS = [
  ['white', 'White or cream'], ['yellow', 'Yellow'], ['orange', 'Orange'], ['red', 'Red'], ['pink', 'Pink'],
  ['purple', 'Purple or violet'], ['blue', 'Blue'], ['green', 'Green'], ['brown', 'Brown or tan'], ['gray', 'Gray'], ['black', 'Black'],
]

export const markGroups = {
  fungi: [
    { key: 'form', label: 'Overall shape', options: [['cap', 'Cap on a stem'], ['shelf', 'Shelf or bracket'], ['ball', 'Ball or puffball'], ['cup', 'Cup or saddle'], ['honeycomb', 'Pitted or brain-like cap'], ['branching', 'Coral, cauliflower or spines'], ['jelly', 'Jelly-like'], ['other', 'Something else']] },
    { key: 'underside', label: 'Under the cap', options: [['gills', 'Gills'], ['pores', 'Pores, like a sponge'], ['teeth', 'Teeth or spines'], ['ridges', 'Blunt, forked ridges'], ['smooth', 'Smooth or none']] },
    { key: 'substrate', label: 'Growing from', options: [['soil', 'Soil or forest floor'], ['wood', 'Wood, living or dead'], ['grass', 'Grass or lawn']] },
    { key: 'colors', label: 'Main cap colour', options: COLORS },
  ],
  herbs: [
    { key: 'form', label: 'Growth form', options: [['herb', 'Soft, non-woody plant'], ['shrub', 'Shrub'], ['tree', 'Tree'], ['vine', 'Vine or climber'], ['succulent', 'Succulent'], ['grass-like', 'Grass-like'], ['fern-like', 'Horsetail-like']] },
    { key: 'leaves', label: 'Leaf arrangement', options: [['opposite', 'Opposite pairs'], ['alternate', 'Alternate'], ['basal', 'Rosette at the base'], ['whorled', 'Whorled'], ['none', 'No obvious leaves']] },
    { key: 'leafShape', label: 'Leaf shape', options: [['simple', 'Simple, unlobed'], ['lobed', 'Lobed or deeply cut'], ['compound', 'Divided into leaflets'], ['needle', 'Needles or scales'], ['strap', 'Narrow and strap-like'], ['fleshy', 'Thick and fleshy']] },
    { key: 'flowers', label: 'Flower colour', options: COLORS.filter(([value]) => !['brown', 'gray', 'black'].includes(value)) },
  ],
}
