import Link from "next/link";
import { TemplateForm } from "../_components/TemplateForm";

export const metadata = {
  title: "Nuevo machote — LexCR",
};

export default function NewTemplatePage() {
  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6">
        <Link
          href="/dashboard/templates"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 focus:outline-none focus:underline"
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
          Machotes
        </Link>
      </nav>

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">Nuevo machote</h1>
        <p className="mt-1 text-sm text-slate-500">
          Redacta una nueva plantilla legal reutilizable.
        </p>
      </div>

      <TemplateForm mode="create" />
    </div>
  );
}
