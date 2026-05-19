export default function Home() {
  return (
    <main className="flex min-h-screen flex-col bg-zinc-50 px-6 py-12 text-zinc-950 sm:px-10">
      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8">
        <div className="space-y-4">
          <p className="text-sm font-medium uppercase text-zinc-500">
            MVP foundation
          </p>
          <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
            Legal Docs SaaS
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-zinc-700">
            Project foundation for legal document template productivity in
            Costa Rica. Product screens, database schema, and document
            generation are intentionally deferred.
          </p>
        </div>

        <div className="grid gap-4 border-t border-zinc-200 pt-8 sm:grid-cols-3">
          <div>
            <h2 className="text-base font-semibold">Architecture</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Modular monolith with clean boundaries for domain, application,
              infrastructure, and features.
            </p>
          </div>
          <div>
            <h2 className="text-base font-semibold">Security</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Supabase, future RLS, OWASP awareness, and strict data
              minimization from the first release.
            </p>
          </div>
          <div>
            <h2 className="text-base font-semibold">Delivery</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Vercel and Supabase Cloud for production, with Docker reserved for
              local development support.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
