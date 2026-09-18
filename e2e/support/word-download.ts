import { expect, type Locator, type Page } from "@playwright/test";

export type MarginProfileLabel = "Frente" | "Vuelto";

/** Diálogo "Descargar Word" que abre el botón (Frente/Vuelto + confirmar). */
export function wordDownloadDialog(page: Page): Locator {
  return page.getByRole("dialog", { name: "Descargar Word" });
}

/**
 * Confirma el diálogo "Descargar Word" con el perfil indicado (Frente si se
 * omite: es el default del diálogo). Asume que el diálogo ya está abierto.
 * El llamador debe haber registrado `page.waitForEvent("download")` antes.
 */
export async function confirmWordDownload(
  page: Page,
  profile?: MarginProfileLabel,
): Promise<void> {
  const dialog = wordDownloadDialog(page);
  await expect(dialog).toBeVisible();
  if (profile) await dialog.getByText(profile, { exact: true }).click();
  await dialog
    .getByRole("button", { name: /^Descargar( de todas formas)?$/ })
    .click();
}

/** Pulsa el botón dado (abre el diálogo) y confirma la descarga. */
export async function openAndConfirmWordDownload(
  page: Page,
  trigger: Locator,
  profile?: MarginProfileLabel,
): Promise<void> {
  await trigger.click();
  await confirmWordDownload(page, profile);
}
