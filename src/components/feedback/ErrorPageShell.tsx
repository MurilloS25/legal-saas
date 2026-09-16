import type { ReactNode } from "react";

export const errorPagePrimaryActionClassName =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-ink-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-ink-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2";

export const errorPageSecondaryActionClassName =
  "inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2";

type ErrorPageShellProps = {
  headingId: string;
  eyebrow: string;
  title: string;
  description: string;
  visualIcon: ReactNode;
  visualBadge: string;
  visualMark: string;
  visualCaption: string;
  visualFooter: string;
  children: ReactNode;
};

export function ErrorPageShell({
  headingId,
  eyebrow,
  title,
  description,
  visualIcon,
  visualBadge,
  visualMark,
  visualCaption,
  visualFooter,
  children,
}: ErrorPageShellProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-8 sm:px-6 sm:py-12">
      <section
        aria-labelledby={headingId}
        className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 lg:grid-cols-[1.08fr_0.92fr]"
      >
        <div className="flex flex-col justify-center p-7 sm:p-12 lg:p-14">
          <div className="mb-10 flex items-center gap-3 sm:mb-14">
            <span
              aria-hidden="true"
              className="flex size-9 cursor-default select-none items-center justify-center rounded-lg bg-ink-900 text-sm font-bold text-white"
            >
              L
            </span>
            <div>
              <p className="text-base font-bold tracking-tight text-slate-900">
                LexCR
              </p>
              <p className="text-xs text-slate-500">Gestión Notarial</p>
            </div>
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            {eyebrow}
          </p>
          <h1
            id={headingId}
            className="mt-3 max-w-lg text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl"
          >
            {title}
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-slate-600 sm:text-base">
            {description}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">{children}</div>
        </div>

        <div
          aria-hidden="true"
          className="group/visual relative flex min-h-72 cursor-default select-none items-center justify-center overflow-hidden bg-ink-900 px-8 py-12 sm:min-h-80 lg:min-h-[34rem]"
        >
          <div className="absolute inset-x-8 top-8 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45 sm:inset-x-10">
            <span>Protocolo digital</span>
            <span>LexCR</span>
          </div>

          <div className="relative mt-6 w-full max-w-[17rem] transition-transform duration-500 ease-out motion-safe:group-hover/visual:-translate-y-1 motion-reduce:transition-none">
            <div className="absolute inset-0 translate-x-3 translate-y-3 rotate-3 rounded-2xl border border-white/15" />
            <div className="absolute inset-0 -translate-x-2 translate-y-1 -rotate-2 rounded-2xl border border-white/10" />

            <div className="relative rounded-2xl border border-white/25 bg-ink-800 p-7 shadow-xl shadow-black/20 sm:p-8">
              <div className="flex items-center justify-between border-b border-white/15 pb-5">
                {visualIcon}
                <span className="rounded-full border border-white/20 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/60">
                  {visualBadge}
                </span>
              </div>

              <p className="mt-7 text-7xl font-semibold tracking-[-0.06em] text-white sm:text-8xl">
                {visualMark}
              </p>

              <div className="mt-7 space-y-2.5">
                <span className="block h-px w-full bg-white/20" />
                <span className="block h-px w-4/5 bg-white/15" />
                <span className="block h-px w-3/5 bg-white/10" />
              </div>

              <div className="mt-7 flex items-end justify-between">
                <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                  {visualCaption}
                </p>
                <span className="flex size-11 items-center justify-center rounded-full border border-white/25 text-sm font-semibold text-white/75 transition-transform duration-500 motion-safe:group-hover/visual:rotate-6 motion-reduce:transition-none">
                  L
                </span>
              </div>
            </div>
          </div>

          <p className="absolute inset-x-8 bottom-7 text-center text-[10px] uppercase tracking-[0.2em] text-white/35">
            {visualFooter}
          </p>
        </div>
      </section>
    </main>
  );
}
