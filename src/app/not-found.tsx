import Link from "next/link";
import { ArrowRightIcon, ScrollIcon } from "@/components/icons";
import {
  ErrorPageShell,
  errorPagePrimaryActionClassName,
} from "@/components/feedback/ErrorPageShell";

export default function NotFound() {
  return (
    <ErrorPageShell
      headingId="not-found-title"
      eyebrow="Ruta no disponible"
      title="Página no encontrada"
      description="La dirección que abriste no existe o fue movida. Puedes volver al panel para continuar trabajando."
      visualIcon={<ScrollIcon className="size-6 text-white/75" />}
      visualBadge="Ruta 404"
      visualMark="404"
      visualCaption="Página ausente"
      visualFooter="La ruta solicitada no está disponible"
    >
      <Link
        href="/dashboard"
        className={`${errorPagePrimaryActionClassName} group/link`}
      >
        Volver al panel
        <ArrowRightIcon className="size-4 transition-transform duration-200 motion-safe:group-hover/link:translate-x-0.5 motion-reduce:transition-none" />
      </Link>
    </ErrorPageShell>
  );
}
