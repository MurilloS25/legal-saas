/**
 * Layout compartido de autenticación (login, registro, recuperación,
 * invitaciones, etc.). REDISEÑO EXPERIMENTAL: panel de marca a la
 * izquierda en escritorio (mismo `ink-*` del sidebar del panel, para que
 * la identidad visual conecte desde el primer segundo con el resto de la
 * app) + columna de formulario a la derecha. En móvil colapsa a una sola
 * columna con la marca arriba, como antes.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen lg:flex">
      {/* Brand panel — desktop only */}
      <div className="relative hidden overflow-hidden bg-ink-900 lg:flex lg:w-[42%] lg:flex-col lg:justify-between lg:px-12 lg:py-12 xl:w-[38%]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 -top-24 size-96 rounded-full bg-accent-500/10 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -right-16 size-96 rounded-full bg-accent-500/10 blur-3xl"
        />

        <div className="relative select-none">
          <p className="text-lg font-semibold tracking-tight text-white">
            LexCR
          </p>
          <p className="text-sm text-ink-400">Gestión Notarial</p>
        </div>

        <p className="relative max-w-sm text-2xl font-medium leading-snug tracking-tight text-white">
          Machotes, escrituras e índice notarial en un mismo espacio de
          trabajo.
        </p>

        <p className="relative text-xs text-ink-400">
          Hecho para abogados independientes en Costa Rica.
        </p>
      </div>

      {/* Form column */}
      <div className="flex flex-1 flex-col items-center justify-center bg-slate-50 px-4 py-12">
        {/* Brand mark — mobile only */}
        <div className="mb-8 text-center select-none lg:hidden">
          <p className="text-2xl font-semibold tracking-tight text-slate-900">
            LexCR
          </p>
          <p className="mt-1 text-sm text-slate-500">Gestión Notarial</p>
        </div>

        <div className="w-full animate-scale-in">{children}</div>
      </div>
    </div>
  );
}
