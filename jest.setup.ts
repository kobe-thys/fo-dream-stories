import '@testing-library/jest-dom'

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))

// Chainable + awaitable Supabase mock
// Every method returns `chain` so you can do .eq().eq()
// `chain` itself is thenable so `await chain` resolves to { data: [], error: null }
function makeChain() {
  const chain: Record<string, unknown> = {
    data: [],
    error: null,
    then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(resolve, reject),
    catch: (reject: (e: unknown) => unknown) =>
      Promise.resolve({ data: [], error: null }).catch(reject),
  }
  const methods = ['select', 'update', 'delete', 'eq', 'in', 'order', 'limit', 'match', 'filter', 'not', 'or', 'range', 'gte', 'lte', 'gt', 'lt', 'ilike', 'like', 'is', 'contains', 'overlaps', 'textSearch']
  for (const m of methods) {
    chain[m] = jest.fn().mockReturnValue(chain)
  }
  chain['insert'] = jest.fn().mockResolvedValue({ error: null })
  chain['upsert'] = jest.fn().mockResolvedValue({ error: null })
  chain['single'] = jest.fn().mockResolvedValue({ data: null, error: null })
  return chain
}

jest.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: jest.fn().mockResolvedValue({ error: null }),
      signUp: jest.fn().mockResolvedValue({ error: null }),
      getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
    },
    from: jest.fn().mockReturnValue(makeChain()),
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({ error: null }),
        getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: '' } }),
      }),
    },
  }),
}))
