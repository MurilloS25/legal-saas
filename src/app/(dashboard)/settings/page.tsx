import { PageContainer } from "@/components/layout/PageContainer";
import { SettingsTabs } from "@/features/settings";
import { loadSettingsPageData } from "@/features/settings/server";

export const metadata = {
  title: "Cuenta y configuración — LexCR",
};

type Props = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function SettingsPage({ searchParams }: Props) {
  const { tab } = await searchParams;
  const settings = await loadSettingsPageData(tab);

  return (
    <PageContainer>
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-slate-900">
            Cuenta y configuración
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Perfil, formato de documentos y despacho.
          </p>
        </div>

        <SettingsTabs {...settings} />
      </div>
    </PageContainer>
  );
}
