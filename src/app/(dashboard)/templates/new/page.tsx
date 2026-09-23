import { redirect } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { CreateWithAiButton, TemplateWorkspace } from "@/features/templates";
import { getAiTemplateGenerationAvailability } from "@/features/templates/server";
import { emptyTemplateDocument } from "@/lib/editor/types";
import { requireWorkspace } from "@/lib/server/auth";
import { hasPermission } from "@/lib/server/permissions";

export const metadata = {
  title: "Nuevo machote — LexCR",
};

export default async function NewTemplatePage() {
  const { role } = await requireWorkspace();
  if (!hasPermission(role, "templates.write")) {
    redirect("/templates");
  }

  // Sin breadcrumb/título propios aquí: `TemplateWorkspace` ya renderiza el
  // encabezado único (breadcrumb + título en vivo + stepper) — una segunda
  // jerarquía visual encima solo duplicaba la navegación de vuelta a
  // Machotes sin agregar información real.
  const aiLimits = getAiTemplateGenerationAvailability();

  return (
    <PageContainer>
      {/* Atajo opcional: la creación manual de abajo sigue siendo el flujo
          por defecto e idéntico al de siempre. */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <p className="text-sm text-slate-600">
          ¿Tienes una escritura existente? LexCR puede proponer las variables y
          crear un borrador para que lo revises.
        </p>
        <CreateWithAiButton limits={aiLimits} />
      </div>
      <TemplateWorkspace
        mode="create"
        initialDocument={emptyTemplateDocument()}
        initialVariables={[]}
      />
    </PageContainer>
  );
}
