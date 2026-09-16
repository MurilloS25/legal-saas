import Link from "next/link";
import type { ComponentType } from "react";
import {
  ArrowRightIcon,
  BookmarkIcon,
  CheckCircleIcon,
  ScrollIcon,
  StackIcon,
  UsersIcon,
  WalletIcon,
} from "@/components/icons";

type IconComponent = ComponentType<{ className?: string }>;

type LandingPageProps = {
  isAuthenticated: boolean;
};

const capabilities: Array<{
  title: string;
  description: string;
  icon: IconComponent;
}> = [
  {
    title: "Clientes",
    description:
      "Conserva la información que utilizas con frecuencia y vuelve a usarla en nuevos documentos.",
    icon: UsersIcon,
  },
  {
    title: "Machotes",
    description:
      "Prepara modelos reutilizables con variables y opciones para trabajar con una estructura consistente.",
    icon: StackIcon,
  },
  {
    title: "Escrituras",
    description:
      "Completa, revisa y descarga documentos Word editables a partir de tus propios Machotes.",
    icon: ScrollIcon,
  },
  {
    title: "Índice Notarial",
    description:
      "Organiza los datos necesarios para revisar y preparar tu índice antes de la gestión oficial.",
    icon: BookmarkIcon,
  },
  {
    title: "Cuentas por cobrar",
    description:
      "Da seguimiento a cobros y pagos relacionados con tu trabajo desde el mismo flujo.",
    icon: WalletIcon,
  },
];

const workflow = [
  {
    number: "01",
    title: "Configura tus Machotes",
    description:
      "Define el contenido, las variables y las opciones que vuelves a utilizar en tu práctica.",
  },
  {
    number: "02",
    title: "Crea Escrituras con información reutilizable",
    description:
      "Selecciona clientes, completa los datos necesarios y revisa el resultado antes de descargarlo.",
  },
  {
    number: "03",
    title: "Continúa con Índice y Cobros",
    description:
      "Mantén el contexto del trabajo mientras preparas el índice y das seguimiento a la cuenta por cobrar.",
  },
];

const primaryLightLinkClassName =
  "group inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-ink-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-ink-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2";

const primaryDarkLinkClassName =
  "group inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-ink-900 shadow-sm transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900";

const secondaryLinkClassName =
  "inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-accent-300 hover:text-accent-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2";

function Brand({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="LexCR, inicio"
      className={`inline-flex items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
        inverted
          ? "focus-visible:ring-accent-400 focus-visible:ring-offset-ink-900"
          : "focus-visible:ring-accent-500 focus-visible:ring-offset-white"
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex size-10 cursor-default select-none items-center justify-center rounded-xl text-sm font-bold ${
          inverted
            ? "border border-white/20 bg-white text-ink-900"
            : "bg-ink-900 text-white"
        }`}
      >
        L
      </span>
      <span>
        <span
          className={`block text-base font-bold tracking-tight ${inverted ? "text-white" : "text-slate-950"}`}
        >
          LexCR
        </span>
        <span
          className={`block text-[11px] ${inverted ? "text-slate-300" : "text-slate-500"}`}
        >
          Gestión Notarial
        </span>
      </span>
    </Link>
  );
}

function SessionAction({
  isAuthenticated,
  dark = false,
  compact = false,
}: {
  isAuthenticated: boolean;
  dark?: boolean;
  compact?: boolean;
}) {
  const href = isAuthenticated ? "/dashboard" : "/login";
  const label = isAuthenticated ? "Ir al panel" : "Iniciar sesión";
  const className = dark
    ? primaryDarkLinkClassName
    : primaryLightLinkClassName;

  return (
    <Link
      href={href}
      className={compact ? `${className} px-4 py-2.5` : className}
    >
      {label}
      {!compact ? (
        <ArrowRightIcon className="size-4 transition-transform duration-200 motion-safe:group-hover:translate-x-0.5 motion-reduce:transition-none" />
      ) : null}
    </Link>
  );
}

function LandingHeader({ isAuthenticated }: LandingPageProps) {
  return (
    <header className="border-b border-white/10 bg-ink-900 text-white">
      <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Brand inverted />

        <nav
          aria-label="Navegación de la página pública"
          className="hidden items-center gap-8 lg:flex"
        >
          {[
            ["Capacidades", "#capacidades"],
            ["Cómo funciona", "#como-funciona"],
            ["Planes y precios", "#planes"],
          ].map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="rounded text-sm font-medium text-slate-300 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900"
            >
              {label}
            </a>
          ))}
        </nav>

        <SessionAction isAuthenticated={isAuthenticated} dark compact />
      </div>
    </header>
  );
}

function DocumentComposition() {
  return (
    <figure className="relative mx-auto w-full max-w-lg lg:mx-0 lg:ml-auto">
      <figcaption className="sr-only">
        Composición conceptual de un Machote que se transforma en Escritura y
        continúa hacia Índice Notarial y Cobros.
      </figcaption>

      <div
        aria-hidden="true"
        className="absolute inset-x-8 bottom-3 top-8 rounded-[2rem] bg-ink-900 shadow-2xl shadow-ink-900/20 sm:inset-x-12"
      />
      <div
        aria-hidden="true"
        className="absolute bottom-11 left-3 top-1 w-[78%] -rotate-3 rounded-3xl border border-slate-200 bg-slate-100 sm:left-6"
      />

      <div
        aria-hidden="true"
        className="relative ml-auto w-[90%] cursor-default select-none rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl shadow-slate-900/15 sm:w-[86%] sm:p-7"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-accent-50 text-accent-700">
              <ScrollIcon className="size-5" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-accent-700">
                Composición documental
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-950">
                Del Machote a la Escritura
              </p>
            </div>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-500">
            LexCR
          </span>
        </div>

        <div className="py-6">
          <div className="space-y-3">
            <span className="block h-2 w-11/12 rounded-full bg-slate-200" />
            <span className="block h-2 w-full rounded-full bg-slate-200" />
            <div className="flex flex-wrap items-center gap-2 py-1">
              <span className="rounded-md border border-accent-200 bg-accent-50 px-2 py-1 text-[10px] font-semibold text-accent-800">
                cliente
              </span>
              <span className="h-2 w-20 rounded-full bg-slate-200" />
              <span className="rounded-md border border-accent-200 bg-accent-50 px-2 py-1 text-[10px] font-semibold text-accent-800">
                acto
              </span>
              <span className="h-2 flex-1 rounded-full bg-slate-200" />
            </div>
            <span className="block h-2 w-10/12 rounded-full bg-slate-200" />
            <span className="block h-2 w-full rounded-full bg-slate-200" />
            <span className="block h-2 w-7/12 rounded-full bg-slate-200" />
          </div>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-200" />
            <ArrowRightIcon className="size-4 text-accent-600" />
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <BookmarkIcon className="size-5 text-accent-600" />
              <p className="mt-3 text-xs font-semibold text-slate-800">
                Índice Notarial
              </p>
              <p className="mt-1 text-[10px] leading-4 text-slate-500">
                Datos preparados
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <WalletIcon className="size-5 text-accent-600" />
              <p className="mt-3 text-xs font-semibold text-slate-800">
                Cobros
              </p>
              <p className="mt-1 text-[10px] leading-4 text-slate-500">
                Seguimiento relacionado
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 pt-4 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          <span>Información reutilizable</span>
          <span>Word editable</span>
        </div>
      </div>
    </figure>
  );
}

function LandingHero({ isAuthenticated }: LandingPageProps) {
  return (
    <section className="overflow-hidden border-b border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16 lg:px-8 lg:py-24">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-700">
            Productividad legal para Costa Rica
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl lg:text-6xl lg:leading-[1.08]">
            Gestión legal y notarial, en un solo lugar.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            Organiza clientes, prepara Machotes y Escrituras, reúne la
            información del Índice Notarial y da seguimiento a tus cobros desde
            un espacio de trabajo conectado.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <SessionAction isAuthenticated={isAuthenticated} />
            <a href="#capacidades" className={secondaryLinkClassName}>
              Conocer LexCR
            </a>
          </div>

          <ul className="mt-10 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
            {["Datos reutilizables", "Documentos editables", "Flujo organizado"].map(
              (item) => (
                <li key={item} className="flex items-center gap-2">
                  <CheckCircleIcon className="size-4 shrink-0 text-accent-600" />
                  {item}
                </li>
              ),
            )}
          </ul>
        </div>

        <DocumentComposition />
      </div>
    </section>
  );
}

function CapabilitiesSection() {
  return (
    <section
      id="capacidades"
      aria-labelledby="capabilities-title"
      className="bg-slate-100"
    >
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.58fr] lg:items-end">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-700">
              El trabajo, en contexto
            </p>
            <h2
              id="capabilities-title"
              className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl"
            >
              Lo esencial de tu práctica en un mismo flujo
            </h2>
          </div>
          <p className="max-w-xl text-base leading-7 text-slate-600 lg:justify-self-end">
            Cada módulo acompaña una parte concreta del trabajo diario, sin
            sustituir tu revisión profesional.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {capabilities.map((capability, index) => {
            const Icon = capability.icon;
            return (
              <article
                key={capability.title}
                className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-[border-color,box-shadow,transform] duration-200 hover:border-accent-200 hover:shadow-lg motion-safe:hover:-translate-y-1 motion-reduce:transition-none ${index < 3 ? "lg:col-span-2" : "lg:col-span-3"}`}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-1 bg-accent-600 opacity-0 transition-opacity group-hover:opacity-100 motion-reduce:transition-none"
                />
                <span className="flex size-11 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-5 text-lg font-semibold text-slate-950">
                  {capability.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {capability.description}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  return (
    <section
      id="como-funciona"
      aria-labelledby="workflow-title"
      className="bg-white"
    >
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-700">
              Cómo funciona
            </p>
            <h2
              id="workflow-title"
              className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl"
            >
              Del Machote al seguimiento, sin perder el hilo
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-600">
              LexCR reúne las etapas relacionadas para que la información útil
              continúe contigo durante el trabajo.
            </p>
          </div>

          <ol className="relative space-y-5 before:absolute before:bottom-8 before:left-6 before:top-8 before:w-px before:bg-accent-200 sm:before:left-7">
            {workflow.map((step) => (
              <li
                key={step.number}
                className="relative grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm sm:grid-cols-[3.75rem_1fr] sm:p-6"
              >
                <span className="relative z-10 flex size-12 items-center justify-center rounded-full border border-accent-200 bg-white text-sm font-semibold tabular-nums text-accent-700 shadow-sm sm:size-14">
                  {step.number}
                </span>
                <div className="sm:pt-1">
                  <h3 className="text-base font-semibold text-slate-950">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {step.description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

function PricingPlaceholder() {
  return (
    <section
      id="planes"
      aria-labelledby="pricing-title"
      className="border-y border-white/10 bg-ink-900 text-white"
    >
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 sm:py-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16 lg:px-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-300">
            Información comercial
          </p>
          <h2
            id="pricing-title"
            className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl"
          >
            Planes y precios
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-slate-300">
            La información comercial de LexCR está en preparación. Publicaremos
            aquí los planes y precios cuando estén definidos.
          </p>
        </div>

        <div className="rounded-2xl border border-white/15 bg-ink-800 p-6 shadow-xl shadow-black/10 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="inline-flex rounded-full border border-accent-400/30 bg-accent-400/10 px-3 py-1 text-xs font-semibold text-accent-200">
                En preparación
              </span>
              <p className="mt-4 text-base font-semibold text-white">
                Una propuesta clara para la práctica independiente
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Sin precios provisionales, planes ficticios ni compra habilitada.
              </p>
            </div>
            <div
              aria-hidden="true"
              className="flex shrink-0 cursor-default select-none items-end gap-2"
            >
              <span className="h-10 w-3 rounded-full bg-white/10" />
              <span className="h-16 w-3 rounded-full bg-accent-400/50" />
              <span className="h-12 w-3 rounded-full bg-white/15" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCallToAction({ isAuthenticated }: LandingPageProps) {
  const title = isAuthenticated
    ? "Continúa tu trabajo en LexCR"
    : "Accede a tu espacio de trabajo";
  const description = isAuthenticated
    ? "Tus clientes, Machotes, Escrituras, Índice y Cobros están listos para continuar."
    : "Inicia sesión con las credenciales de tu espacio para gestionar clientes, documentos, índice y cobros.";

  return (
    <section aria-labelledby="final-cta-title" className="bg-slate-100">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-ink-800 px-6 py-12 text-center shadow-2xl shadow-ink-900/15 sm:px-12 sm:py-16">
          <div
            aria-hidden="true"
            className="absolute inset-x-10 top-8 flex cursor-default select-none justify-between text-[10px] font-semibold uppercase tracking-[0.2em] text-white/25"
          >
            <span>LexCR</span>
            <span>Gestión Notarial</span>
          </div>
          <div className="relative mx-auto max-w-2xl pt-5">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-300">
              Tu espacio de trabajo
            </p>
            <h2
              id="final-cta-title"
              className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-4xl"
            >
              {title}
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-300">
              {description}
            </p>
            <div className="mt-8">
              <SessionAction isAuthenticated={isAuthenticated} dark />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="border-t border-white/10 bg-ink-900 text-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <Brand inverted />
          <nav aria-label="Navegación del pie" className="flex flex-wrap gap-x-6 gap-y-3">
            <a
              href="#capacidades"
              className="rounded text-sm text-slate-300 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
            >
              Capacidades
            </a>
            <a
              href="#como-funciona"
              className="rounded text-sm text-slate-300 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
            >
              Cómo funciona
            </a>
            <a
              href="#planes"
              className="rounded text-sm text-slate-300 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400"
            >
              Planes y precios
            </a>
          </nav>
        </div>

        <div className="mt-9 border-t border-white/10 pt-6">
          <p className="max-w-3xl text-xs leading-5 text-slate-400">
            LexCR apoya la gestión del trabajo legal y notarial. La revisión y
            las actuaciones profesionales permanecen bajo responsabilidad de
            cada usuario.
          </p>
        </div>
      </div>
    </footer>
  );
}

export function LandingPage({ isAuthenticated }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-white text-slate-950">
      <a
        href="#contenido-principal"
        className="sr-only z-50 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:ring-2 focus:ring-accent-500"
      >
        Ir al contenido principal
      </a>
      <LandingHeader isAuthenticated={isAuthenticated} />
      <main id="contenido-principal">
        <LandingHero isAuthenticated={isAuthenticated} />
        <CapabilitiesSection />
        <HowItWorksSection />
        <PricingPlaceholder />
        <FinalCallToAction isAuthenticated={isAuthenticated} />
      </main>
      <LandingFooter />
    </div>
  );
}
