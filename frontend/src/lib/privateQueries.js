// Keep legacy roots here as well, so an identity change clears pre-upgrade caches.
const PRIVATE_ROOTS = new Set(['membership', 'supporter-confirmation', 'journal', 'logbook', 'saved-locations', 'account-sessions', 'moderation-queue', 'alerts', 'herb-watch-zones', 'herb-inventory', 'herb-wishlist'])

export function clearPrivateQueries(client) {
  const predicate = query => query.meta?.private === true || PRIVATE_ROOTS.has(query.queryKey[0])
  // Cancellation is synchronous; consuming the signal also aborts the transport.
  void client.cancelQueries({ predicate })
  client.removeQueries({ predicate })
}

export function setSessionUser(client, user) {
  void client.cancelQueries({ queryKey: ['current-user'], exact: true })
  clearPrivateQueries(client)
  client.setQueryData(['current-user'], user)
}

export function privateQueryOptions(key, user, queryFn, enabled = true) {
  return {
    queryKey: [key, user?.id ?? null],
    meta: { private: true },
    enabled: Boolean(user?.id) && enabled,
    queryFn,
    retry: (attempt, error) => error?.response?.status !== 401 && attempt < 1,
  }
}
