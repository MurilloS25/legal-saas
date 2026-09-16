import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10 sm:px-6">
      <section
        aria-labelledby="not-found-title"
        className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm sm:grid sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"
      >
        <div className="flex min-h-48 flex-col justify-between bg-ink-800 p-7 text-white sm:min-h-96 sm:p-10">
          <div>
            <p className="text-xl font-bold tracking-tight">LexCR</p>
            <p className="mt-1 text-sm text-ink-200">Gestión Notarial</p>
          </div>

          <p
            aria-hidden="true"
            className="mt-10 text-7xl font-semibold tracking-tight text-accent-400 sm:text-8xl"
          >
            404
          </p>
        </div>

        <div className="flex flex-col justify-center p-7 sm:p-10">
          <p className="text-xs font-semibold uppercase tracking-wider text-accent-700">
            Ruta no disponible
          </p>
          <h1
            id="not-found-title"
            className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl"
          >
            Página no encontrada
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-600">
            La dirección que abriste no existe o fue movida. Puedes volver al
            panel para continuar trabajando.
          </p>

          <Link
            href="/dashboard"
            className="mt-7 inline-flex w-fit items-center gap-2 rounded-lg bg-accent-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
          >
            Volver al panel
            <ArrowRightIcon className="size-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
