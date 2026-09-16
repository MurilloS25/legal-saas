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

const primaryLinkClassName =
  "group inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-ink-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-ink-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2";

const secondaryLinkClassName =
  "inline-flex cursor-pointer items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-accent-300 hover:text-accent-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2";

function Brand() {
  return (
    <Link
      href="/"
      aria-label="LexCR, inicio"
      className="inline-flex items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
    >
      <span
        aria-hidden="true"
        className="flex size-9 cursor-default select-none items-center justify-center rounded-lg bg-ink-900 text-sm font-bold text-white"
      >
        L
      </span>
      <span>
        <span className="block text-base font-bold tracking-tight text-slate-950">
          LexCR
        </span>
        <span className="block text-[11px] text-slate-500">
          Gestión Notarial
        </span>
      </span>
    </Link>
  );
}

function LandingHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex min-h-18 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Brand />

        <nav
          aria-label="Navegación de la página pública"
          className="hidden items-center gap-7 md:flex"
        >
          <a
            href="#capacidades"
            className="rounded text-sm font-medium text-slate-600 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
          >
            Capacidades
          </a>
          <a
            href="#como-funciona"
            className="rounded text-sm font-medium text-slate-600 hover:text-slate-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2"
          >
            Cómo funciona
          </a>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="rounded-lg px-2.5 py-2 text-sm font-semibold text-slate-700 hover:text-accent-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 sm:px-3"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-lg bg-ink-900 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-ink-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500 focus-visible:ring-offset-2 sm:px-4"
          >
            Ir al panel
          </Link>
        </div>
      </div>
    </header>
  );
}

function WorkflowPreview() {
  return (
    <div className="relative mx-auto w-full max-w-lg lg:mx-0 lg:ml-auto">
      <div
        aria-hidden="true"
        className="absolute -left-4 top-8 hidden h-full w-full rounded-3xl border border-slate-200 lg:block"
      />
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
        <div className="flex items-center justify-between border-b border-slate-200 bg-ink-900 px-5 py-4 text-white sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-300">
              Un flujo conectado
            </p>
            <p className="mt-1 text-sm font-semibold">Escritura de ejemplo</p>
          </div>
          <span className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/75">
            Borrador
          </span>
        </div>

        <div className="space-y-4 p-5 sm:p-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent-50 text-accent-700">
                <StackIcon className="size-5" />
              </span>
              <div>
                <p className="text-xs text-slate-500">Machote seleccionado</p>
                <p className="text-sm font-semibold text-slate-900">
                  Compraventa de inmueble
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-200 p-4">
              <UsersIcon className="size-5 text-accent-600" />
              <p className="mt-4 text-xs text-slate-500">Información</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                Clientes reutilizables
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <ScrollIcon className="size-5 text-accent-600" />
              <p className="mt-4 text-xs text-slate-500">Documento</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                Word editable
              </p>
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200 p-4">
            {[
              ["Completar Escritura", "En proceso"],
              ["Preparar Índice", "Pendiente"],
              ["Dar seguimiento al cobro", "Pendiente"],
            ].map(([label, status], index) => (
              <div
                key={label}
                className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0"
              >
                <span className="flex items-center gap-2 text-sm text-slate-700">
                  <span
                    aria-hidden="true"
                    className={`size-2 rounded-full ${index === 0 ? "bg-accent-500" : "bg-slate-300"}`}
                  />
                  {label}
                </span>
                <span className="text-xs text-slate-500">{status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LandingHero() {
  return (
    <section className="overflow-hidden border-b border-slate-200 bg-slate-50">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16 lg:px-8 lg:py-24">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent-700">
            Productividad legal para Costa Rica
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-5xl lg:text-6xl lg:leading-[1.08]">
            Gestión legal y notarial, en un solo lugar.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            Organiza clientes, prepara Machotes y Escrituras, reúne la
            información del Índice Notarial y da seguimiento a tus cobros desde
            un espacio de trabajo conectado.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/login" className={primaryLinkClassName}>
              Iniciar sesión
              <ArrowRightIcon className="size-4 transition-transform duration-200 motion-safe:group-hover:translate-x-0.5 motion-reduce:transition-none" />
            </Link>
            <a href="#capacidades" className={secondaryLinkClassName}>
              Conocer LexCR
            </a>
          </div>

          <ul className="mt-9 grid gap-3 text-sm text-slate-600 sm:grid-cols-3">
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

        <WorkflowPreview />
      </div>
    </section>
  );
}

function CapabilitiesSection() {
  return (
    <section id="capacidades" aria-labelledby="capabilities-title" className="bg-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
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
          <p className="mt-4 text-base leading-7 text-slate-600">
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
                className={`rounded-2xl border border-slate-200 bg-white p-6 ${index < 3 ? "lg:col-span-2" : "lg:col-span-3"}`}
              >
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
      className="border-y border-slate-200 bg-slate-50"
    >
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
        <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16">
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

          <ol className="space-y-4">
            {workflow.map((step) => (
              <li
                key={step.number}
                className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-[3.5rem_1fr] sm:p-6"
              >
                <span className="text-sm font-semibold tabular-nums text-accent-700">
                  {step.number}
                </span>
                <div>
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

function FinalCallToAction() {
  return (
    <section aria-labelledby="final-cta-title" className="bg-white">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-ink-900 px-6 py-12 text-center sm:px-12 sm:py-16">
          <div
            aria-hidden="true"
            className="absolute inset-x-10 top-8 flex cursor-default select-none justify-between text-[10px] font-semibold uppercase tracking-[0.2em] text-white/30"
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
              Continúa tu trabajo en LexCR
            </h2>
            <p className="mt-4 text-base leading-7 text-slate-300">
              Accede con las credenciales de tu espacio de trabajo para gestionar
              clientes, documentos, índice y cobros.
            </p>
            <Link
              href="/login"
              className="group mt-8 inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-ink-900 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-900"
            >
              Iniciar sesión
              <ArrowRightIcon className="size-4 transition-transform duration-200 motion-safe:group-hover:translate-x-0.5 motion-reduce:transition-none" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <Brand />
        <p className="max-w-xl text-xs leading-5 text-slate-500 md:text-right">
          LexCR apoya la gestión del trabajo legal y notarial. La revisión y las
          actuaciones profesionales permanecen bajo responsabilidad de cada
          usuario.
        </p>
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-950">
      <a
        href="#contenido-principal"
        className="sr-only z-50 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:ring-2 focus:ring-accent-500"
      >
        Ir al contenido principal
      </a>
      <LandingHeader />
      <main id="contenido-principal">
        <LandingHero />
        <CapabilitiesSection />
        <HowItWorksSection />
        <FinalCallToAction />
      </main>
      <LandingFooter />
    </div>
  );
}
