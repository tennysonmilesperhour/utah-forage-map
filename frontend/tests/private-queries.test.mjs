import test from 'node:test'
import assert from 'node:assert/strict'
import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { privateQueryOptions, setSessionUser } from '../src/lib/privateQueries.js'

test('account switching never supplies the previous notebook while loading or on failure', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } })
  const a = { id: 'A' }; const b = { id: 'B' }
  setSessionUser(client, a)
  client.setQueryData(['logbook', a.id], [{ notes: 'A private note', latitude: 1 }])
  client.setQueryData(['herb-inventory', a.id], [{ name: 'A private inventory' }])
  client.setQueryData(['journal', a.id, 'collections'], ['A private collection'])
  setSessionUser(client, null)
  assert.equal(client.getQueryCache().getAll().some(q => q.queryKey[0] !== 'current-user'), false)
  setSessionUser(client, b)
  let fail
  const observer = new QueryObserver(client, { ...privateQueryOptions('logbook', b, () => new Promise((_, reject) => { fail = reject })), retry: false })
  const unsubscribe = observer.subscribe(() => {})
  assert.equal(observer.getCurrentResult().data, undefined)
  assert.equal(observer.getCurrentResult().isPending, true)
  fail(new Error('offline'))
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(observer.getCurrentResult().isError, true)
  assert.equal(observer.getCurrentResult().data, undefined)
  unsubscribe(); client.clear()
})

test('logout cancels transport and a late non-cooperative response cannot repopulate private data', async () => {
  const client = new QueryClient()
  let resolve; let requestSignal
  const pending = client.fetchQuery(privateQueryOptions('saved-locations', { id: 'A' }, ({ signal }) => {
    requestSignal = signal
    return new Promise(done => { resolve = done })
  })).catch(() => undefined)
  setSessionUser(client, null)
  assert.equal(requestSignal.aborted, true)
  resolve(['late private coordinates'])
  await pending
  assert.equal(client.getQueryData(['saved-locations', 'A']), undefined)
  assert.equal(client.getQueryData(['current-user']), null)
  client.clear()
})

test('identity reset clears all legacy private roots and preserves public data', () => {
  const client = new QueryClient()
  for (const key of ['logbook', 'saved-locations', 'account-sessions', 'moderation-queue', 'alerts', 'herb-watch-zones', 'herb-inventory', 'herb-wishlist', 'journal']) client.setQueryData([key], ['private'])
  client.setQueryData(['regions'], ['public'])
  setSessionUser(client, null) // also used by account deletion, password reset and session expiration
  assert.deepEqual(client.getQueryData(['regions']), ['public'])
  assert.deepEqual(client.getQueryCache().getAll().map(q => q.queryKey[0]).sort(), ['current-user', 'regions'])
  assert.equal(privateQueryOptions('logbook', null, () => {}).enabled, false)
  client.clear()
})
