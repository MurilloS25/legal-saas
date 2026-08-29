/**
 * Botón compartido — variantes/tamaños centralizados para toda la app.
 *
 * Antes de esta iteración cada feature reimplementaba `<button>` con clases
 * Tailwind sueltas. Este componente es la fuente única de verdad visual:
 * radio `rounded-lg` (8px, ver SHAPE CONSISTENCY LOCK en DESIGN.md),
 * feedback de presión `scale(0.97)`, foco visible siempre.
 */
import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "accent" | "secondary" | "destructive" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANT_CLASS: Record<Variant, string> = {
  primary:
    "bg-ink-900 text-white hover:bg-ink-800 focus-visible:ring-accent-500",
  accent:
    "bg-accent-600 text-white hover:bg-accent-700 focus-visible:ring-accent-500",
  secondary:
    "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 focus-visible:ring-accent-500",
  destructive:
    "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500",
  ghost:
    "bg-transparent text-slate-600 hover:bg-slate-100 focus-visible:ring-accent-500",
};

const SIZE_CLASS: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-sm gap-2",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  loadingText?: string;
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = "primary",
    size = "md",
    loading = false,
    loadingText,
    disabled,
    className,
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={[
        "press-feedback inline-flex shrink-0 items-center justify-center rounded-lg font-medium",
        "transition-colors duration-150 ease-out",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {loading ? (loadingText ?? "Guardando…") : children}
    </button>
  );
});
