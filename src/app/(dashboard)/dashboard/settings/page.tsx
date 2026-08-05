import { PageContainer } from "@/components/layout/PageContainer";
import { requireWorkspace } from "@/lib/server/auth";
import { SettingsWorkspace } from "./_components/SettingsWorkspace";

export const metadata = {
  title: "Configuración — LexCR",
};

export default async function SettingsPage() {
  const { supabase, workspaceId } = await requireWorkspace();

  // Fetch profile and settings in parallel; both may return null for new users.
  const [profileResult, settingsResult] = await Promise.all([
    supabase
      .from("lawyer_profiles")
      .select("full_name, professional_code, email, phone")
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    supabase
      .from("document_settings")
      .select(
        "font_family, font_size, margin_top_cm, margin_bottom_cm, margin_left_cm, margin_right_cm, line_spacing",
      )
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
  ]);

  return (
    <PageContainer>
      <div className="max-w-5xl mx-auto">
        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-900">
            Configuración
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Administra tu información profesional y las preferencias de los
            documentos.
          </p>
        </div>

        <SettingsWorkspace
          initialProfile={profileResult.data}
          initialSettings={settingsResult.data}
        />
      </div>
    </PageContainer>
  );
}
