/**
 * Contenedor compartido del contenido autenticado.
 *
 * `wide` (default): listados, panel y vistas de detalle — ocupa el ancho
 * disponible después del sidebar con padding lateral razonable, limitado
 * solo en monitores muy anchos.
 *
 * `form`: formularios independientes de crear/editar — más anchos que
 * antes pero acotados para mantener legibilidad.
 */

type Props = {
  children: React.ReactNode;
  width?: "wide" | "form";
  className?: string;
};

const WIDTH_CLASS: Record<NonNullable<Props["width"]>, string> = {
  wide: "max-w-screen-2xl",
  form: "max-w-4xl",
};

export function PageContainer({ children, width = "wide", className }: Props) {
  const classes = [
    "w-full",
    WIDTH_CLASS[width],
    "mx-auto px-4 py-8 sm:px-6 lg:px-10",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes}>{children}</div>
  );
}
