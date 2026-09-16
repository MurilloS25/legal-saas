"use client";

import { MobileViewToggle } from "@/components/ui/MobileViewToggle";

export type TemplateMobileView = "edit" | "preview";

type Props = {
  value: TemplateMobileView;
  onChange: (value: TemplateMobileView) => void;
};

export function TemplateMobileViewToggle({ value, onChange }: Props) {
  return (
    <MobileViewToggle
      value={value}
      options={[
        { value: "edit", label: "Editar" },
        { value: "preview", label: "Vista previa" },
      ]}
      onChange={onChange}
    />
  );
}
