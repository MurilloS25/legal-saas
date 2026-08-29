/**
 * Superficie compartida (card). `interactive` añade hover/focus para
 * cards clicables (envolver siempre en `<Link>`, ver DESIGN.md §7).
 *
 * Acepta y reenvía atributos HTML estándar del `<div>` (`role`,
 * `aria-*`, etc.) — un contenedor de filtros/formulario dentro de un Card
 * suele necesitar `role="group"`/`aria-busy` sin perder el resto de la
 * API tipada.
 */
import type { HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLDivElement> & {
  children: React.ReactNode;
  className?: string;
  interactive?: boolean;
  padding?: "none" | "sm" | "md";
};

const PADDING_CLASS: Record<NonNullable<Props["padding"]>, string> = {
  none: "",
  sm: "p-4",
  md: "p-5 sm:p-6",
};

export function Card({
  children,
  className,
  interactive = false,
  padding = "md",
  ...rest
}: Props) {
  return (
    <div
      className={[
        "rounded-xl border border-slate-200 bg-white shadow-ink-sm",
        PADDING_CLASS[padding],
        interactive
          ? "transition-[border-color,box-shadow,transform] duration-150 ease-out hover:border-accent-200 hover:shadow-ink-md focus-visible:ring-2 focus-visible:ring-accent-500"
          : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}
