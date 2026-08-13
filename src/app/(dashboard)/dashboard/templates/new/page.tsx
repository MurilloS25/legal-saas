import { redirect } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { TemplateWorkspace } from "@/features/templates";
import { emptyTemplateDocument } from "@/lib/editor/types";
import { requireWorkspace } from "@/lib/server/auth";
import { hasPermission } from "@/lib/server/permissions";

export const metadata = {
  title: "Nuevo machote — LexCR",
};

export default async function NewTemplatePage() {
  const { role } = await requireWorkspace();
  if (!hasPermission(role, "templates.write")) {
    redirect("/dashboard/templates");
  }

  // Sin breadcrumb/título propios aquí: `TemplateWorkspace` ya renderiza el
  // encabezado único (breadcrumb + título en vivo + stepper) — una segunda
  // jerarquía visual encima solo duplicaba la navegación de vuelta a
  // Machotes sin agregar información real.
  return (
    <PageContainer>
      <TemplateWorkspace
        mode="create"
        initialDocument={emptyTemplateDocument()}
        initialVariables={[]}
      />
    </PageContainer>
  );
}
