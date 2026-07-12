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
};

const WIDTH_CLASS: Record<NonNullable<Props["width"]>, string> = {
  wide: "max-w-screen-2xl",
  form: "max-w-4xl",
};

export function PageContainer({ children, width = "wide" }: Props) {
  return (
    <div
      className={`w-full ${WIDTH_CLASS[width]} mx-auto px-4 py-8 sm:px-6 lg:px-10`}
    >
      {children}
    </div>
  );
}
