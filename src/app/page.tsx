import type { Metadata } from "next";
import { LandingPage } from "./_components/LandingPage";

export const metadata: Metadata = {
  title: "LexCR — Gestión legal y notarial",
  description:
    "Organiza clientes, machotes, escrituras, índice notarial y cuentas por cobrar desde un mismo espacio de trabajo.",
};

export default function Home() {
  return <LandingPage />;
}
