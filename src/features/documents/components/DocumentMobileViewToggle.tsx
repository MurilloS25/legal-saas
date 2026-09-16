"use client";

import type { DocumentMobileView } from "../hooks/use-document-layout";
import { MobileViewToggle } from "@/components/ui/MobileViewToggle";

type Props = {
  value: DocumentMobileView;
  onChange: (value: DocumentMobileView) => void;
};

export function DocumentMobileViewToggle({ value, onChange }: Props) {
  return (
    <MobileViewToggle
      value={value}
      options={[
        { value: "data", label: "Datos" },
        { value: "document", label: "Documento" },
      ]}
      onChange={onChange}
    />
  );
}
