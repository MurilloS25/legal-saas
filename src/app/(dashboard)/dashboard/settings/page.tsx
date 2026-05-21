import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./_components/ProfileForm";
import { DocumentSettingsForm } from "./_components/DocumentSettingsForm";

export const metadata = {
  title: "Configuración — Legal Docs SaaS",
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
    <main className="mx-auto max-w-3xl px-6 py-12">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <div>
          <nav className="mb-1">
            <Link
              href="/dashboard"
              className="text-sm text-slate-500 hover:text-slate-700 focus:outline-none focus:underline"
            >
              ← Panel
            </Link>
          </nav>
          <h1 className="text-2xl font-semibold text-slate-900">
            Configuración
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Perfil profesional y preferencias documentales.
          </p>
        </div>
      </div>

      <div className="space-y-8">
        <ProfileForm initialData={profileResult.data} />
        <DocumentSettingsForm initialData={settingsResult.data} />
      </div>
    </main>
  );
}
