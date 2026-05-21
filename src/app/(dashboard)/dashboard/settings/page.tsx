import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./_components/ProfileForm";
import { DocumentSettingsForm } from "./_components/DocumentSettingsForm";

export const metadata = {
  title: "Configuración — LexCR",
};

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch profile and settings in parallel; both may return null for new users.
  const [profileResult, settingsResult] = await Promise.all([
    supabase
      .from("lawyer_profiles")
      .select("full_name, professional_code, email, phone")
      .eq("owner_id", user.id)
      .maybeSingle(),
    supabase
      .from("document_settings")
      .select(
        "font_family, font_size, margin_top_cm, margin_bottom_cm, margin_left_cm, margin_right_cm, line_spacing",
      )
      .eq("owner_id", user.id)
      .maybeSingle(),
  ]);

  return (
    <div className="px-6 py-8 max-w-3xl mx-auto">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-slate-900">
          Configuración
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Perfil profesional y preferencias de documentos.
        </p>
      </div>

      <div className="space-y-8">
        <ProfileForm initialData={profileResult.data} />
        <DocumentSettingsForm initialData={settingsResult.data} />
      </div>
    </div>
  );
}
