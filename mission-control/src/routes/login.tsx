import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>) => ({
    error: search.error === 'invalid' ? ('invalid' as const) : undefined,
  }),
  component: LoginPage,
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { handleMcLoginPost } = await import('@/server/mcLoginPost')
        return await handleMcLoginPost(request)
      },
    },
  },
})

function LoginPage() {
  const { error } = Route.useSearch()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-slate-100">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
            Mission Control
          </h1>
          <p className="mt-2 text-sm text-slate-400">Sign in to continue</p>
        </div>

        <form
          method="post"
          action="/login"
          className="space-y-5 rounded-lg border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur"
        >
          {error === 'invalid' ? (
            <div
              className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200"
              role="alert"
            >
              Invalid username or password.
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label
              htmlFor="mc-username"
              className="block text-xs font-medium uppercase tracking-wide text-slate-400"
            >
              Username
            </label>
            <input
              id="mc-username"
              name="username"
              type="text"
              autoComplete="username"
              required
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/40 focus:border-emerald-600 focus:ring-2"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="mc-password"
              className="block text-xs font-medium uppercase tracking-wide text-slate-400"
            >
              Password
            </label>
            <input
              id="mc-password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none ring-emerald-500/40 focus:border-emerald-600 focus:ring-2"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-950"
          >
            Sign in
          </button>
        </form>

      </div>
    </div>
  )
}
