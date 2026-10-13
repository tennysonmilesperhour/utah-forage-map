import assert from 'node:assert/strict'
import test from 'node:test'
import { checkFreshness } from '../scripts/check-production.mjs'

const covered = new Date(Date.now() - 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z')

function response({ ok = true, status = 200, body = '' } = {}) {
  return {
    ok,
    status,
    async json() { return JSON.parse(body) },
    async text() { return body },
  }
}

test('a database error includes the response body', async () => {
  await assert.rejects(
    () => checkFreshness('https://example.test', async () => response({
      ok: false,
      status: 500,
      body: 'Internal Server Error',
    })),
    /Freshness endpoint HTTP 500: Internal Server Error/,
  )
})

test('current coverage within a day passes', async () => {
  const status = await checkFreshness('https://example.test', async () => response({
    body: JSON.stringify({
      status: 'current',
      covered_through: covered,
      incremental_backlog: false,
    }),
  }))
  assert.equal(status.status, 'current')
})

test('stale coverage fails after the body is accepted', async () => {
  await assert.rejects(
    () => checkFreshness('https://example.test', async () => response({
      body: JSON.stringify({
        status: 'stale',
        covered_through: '2026-10-10T11:00:02.376028',
        incremental_backlog: false,
      }),
    })),
    /unfinished incremental backlog/,
  )
})
