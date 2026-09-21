import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {connections,plantCorrespondences,signs,planets} from '../src/data/astrology.js'
const guide=JSON.parse(readFileSync(new URL('../src/data/herb-guide.json',import.meta.url)))
test('every correspondence resolves to a botanical profile and recognized tradition values',()=>{
 assert.equal(signs.length,12);assert.equal(planets.length,7)
 for(const [slug,entry] of Object.entries(plantCorrespondences)){
  assert.ok(guide.some(p=>p.slug===slug),slug)
  assert.ok(planets.some(p=>p.name===entry.planet),slug)
  assert.ok(entry.heading&&entry.note)
  for(const sign of entry.signs)assert.ok(signs.some(s=>s.name===sign))
 }
})
test('personal links explain direct signs and ruler inference without a false Saturn-balm match',()=>{
 const balm=plantCorrespondences['lemon-balm']
 assert.equal(balm.planet,'Jupiter')
 assert.deepEqual(connections({astrology_enabled:false,placements:{Moon:'Cancer'}},balm),[])
 assert.deepEqual(connections({astrology_enabled:true,placements:{Sun:'Capricorn'}},balm),[])
 assert.match(connections({astrology_enabled:true,placements:{Moon:'Cancer'}},balm)[0],/sign named/)
 assert.match(connections({astrology_enabled:true,placements:{Sun:'Pisces'}},balm)[0],/shared traditional ruler/)
 assert.deepEqual(connections({astrology_enabled:true},undefined),[])
})
