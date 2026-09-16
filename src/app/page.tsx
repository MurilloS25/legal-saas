import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { LandingPage } from "./_components/LandingPage";

export const metadata: Metadata = {
  title: "LexCR — Gestión legal y notarial",
  description:
    "Organiza clientes, machotes, escrituras, índice notarial y cuentas por cobrar desde un mismo espacio de trabajo.",
};

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <LandingPage isAuthenticated={Boolean(user)} />;
}
