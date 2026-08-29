/**
 * Badge compartido — pill con color semántico. Nunca solo color: siempre
 * acompañado de texto (ver DESIGN.md §7 "Badges").
 */
type Tone = "success" | "warning" | "error" | "info" | "neutral" | "accent";

const TONE_CLASS: Record<Tone, string> = {
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  error: "bg-red-50 text-red-700 border-red-200",
  info: "bg-slate-100 text-slate-600 border-slate-200",
  neutral: "bg-slate-50 text-slate-500 border-slate-200",
  accent: "bg-accent-50 text-accent-700 border-accent-200",
};

type Props = {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
};

export function Badge({ tone = "neutral", children, className }: Props) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        TONE_CLASS[tone],
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}
