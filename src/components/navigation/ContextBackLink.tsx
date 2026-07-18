import Link from "next/link";

/**
 * Enlace de regreso al contexto de origen (p. ej. "Volver a la Escritura"
 * tras crear o abrir una Cuenta por cobrar desde su pestaña). Puramente
 * presentacional: el llamador debe pasar una ruta ya validada (ver
 * `src/lib/navigation/context-return.ts`) y una etiqueta fija — nunca un
 * texto proveniente de query params.
 */

type Props = {
  href: string;
  label: string;
};

export function ContextBackLink({ href, label }: Props) {
  return (
    <Link
      href={href}
      className="mb-2 flex w-fit items-center gap-1.5 text-xs font-medium text-accent-700 hover:text-accent-800 focus:outline-none focus:underline"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
      {label}
    </Link>
  );
}
