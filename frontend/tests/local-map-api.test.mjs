import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { localMapApiMiddleware } from '../server/local-map-api.js'

test('local map services return JSON before the SPA fallback and preserve API errors', async t => {
  const server = createServer((request, response) => {
    localMapApiMiddleware(request, response, error => {
      response.statusCode = error ? 500 : 200
      response.setHeader('Content-Type', 'text/html')
      response.end(error ? 'Unexpected error' : '<main>SPA</main>')
    })
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  const origin = `http://127.0.0.1:${server.address().port}`

  const country = await fetch(`${origin}/visitor-country?test=1`, { headers: { 'x-vercel-ip-country': 'US' } })
  assert.match(country.headers.get('content-type'), /application\/json/)
  assert.equal(country.headers.get('cache-control'), 'private, no-store')
  assert.deepEqual(await country.json(), { country: 'US' })
  assert.deepEqual(await (await fetch(`${origin}/visitor-country`)).json(), { country: null })

  const invalid = await fetch(`${origin}/herb-observations?bbox=bad`)
  assert.equal(invalid.status, 400)
  assert.match(invalid.headers.get('content-type'), /application\/json/)
  assert.match((await invalid.json()).error, /valid map area/)
  const write = await fetch(`${origin}/herb-observations`, { method: 'POST' })
  assert.equal(write.status, 405)
  assert.equal(write.headers.get('allow'), 'GET')

  for (const path of ['/map', '/herbs/map', '/api/sightings', '/visitor-country-extra']) {
    assert.equal(await (await fetch(origin + path)).text(), '<main>SPA</main>')
  }
})
