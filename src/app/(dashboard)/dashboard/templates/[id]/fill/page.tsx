import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ id: string }>;
};

// El flujo de llenado ahora vive en Escrituras. Esta ruta se conserva solo
// para no romper enlaces existentes y redirige al flujo compartido.
export default async function FillTemplatePage({ params }: Props) {
  const { id } = await params;
  redirect(`/dashboard/documents/new/${id}`);
}
